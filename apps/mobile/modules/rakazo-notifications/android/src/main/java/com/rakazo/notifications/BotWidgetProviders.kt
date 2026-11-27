package com.rakazo.notifications

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews

/** Several bots in sight: one row each, as many as the widget's height holds. */
class RakazoBotsWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val bots = BotWidgets.read(context)
    for (id in ids) drawBotWidget(context, manager, id, bots, single = false)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    drawBotWidget(context, manager, id, BotWidgets.read(context), single = false)
  }
}

/** One bot in full: the one that most needs the user's eye, as the multi-bot widget's first row. */
class RakazoBotWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val bots = BotWidgets.read(context)
    for (id in ids) drawBotWidget(context, manager, id, bots, single = true)
  }
}

/** `botColors` from @rakazo/ui-tokens: bots carry the only identity colour. */
private val BOT_COLORS = intArrayOf(
  0xFF3EC5A8.toInt(),
  0xFFF5A03C.toInt(),
  0xFF6A6BF5.toInt(),
  0xFF9B5CF6.toInt(),
  0xFF3B82F6.toInt(),
  0xFFF2622A.toInt(),
  0xFFD9508A.toInt(),
)

/** A row is about this tall, so a resized widget shows as many as fit. */
private const val ROW_DP = 52
private const val HEADER_DP = 24

internal fun drawBotWidget(
  context: Context,
  manager: AppWidgetManager,
  id: Int,
  bots: List<BotWidgetBot>,
  single: Boolean,
) {
  // Labels follow the language chosen in the app, as its notifications do.
  val copy = localizedContext(context, NotificationStorage(context).locale)
  val views = if (single) {
    singleBotViews(context, copy, bots.firstOrNull())
  } else {
    botsViews(context, copy, bots, rowsFor(manager.getAppWidgetOptions(id)))
  }
  manager.updateAppWidget(id, views)
}

private fun rowsFor(options: Bundle?): Int {
  val height = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) ?: 0
  if (height <= 0) return 3
  return ((height - HEADER_DP) / ROW_DP).coerceIn(1, MAX_WIDGET_BOTS)
}

private fun botsViews(context: Context, copy: Context, bots: List<BotWidgetBot>, rows: Int): RemoteViews {
  val views = RemoteViews(context.packageName, R.layout.rakazo_bots_widget)
  views.setOnClickPendingIntent(R.id.rakazo_widget_root, openApp(context))
  views.removeAllViews(R.id.rakazo_widget_rows)
  views.setViewVisibility(R.id.rakazo_widget_empty, if (bots.isEmpty()) View.VISIBLE else View.GONE)
  for (bot in bots.take(rows)) {
    val row = RemoteViews(context.packageName, R.layout.rakazo_bot_widget_row)
    bindBot(row, copy, bot)
    row.setOnClickPendingIntent(R.id.rakazo_widget_bot, openChat(context, bot))
    views.addView(R.id.rakazo_widget_rows, row)
  }
  return views
}

private fun singleBotViews(context: Context, copy: Context, bot: BotWidgetBot?): RemoteViews {
  val views = RemoteViews(context.packageName, R.layout.rakazo_bot_widget)
  views.setViewVisibility(R.id.rakazo_widget_empty, if (bot == null) View.VISIBLE else View.GONE)
  views.setViewVisibility(R.id.rakazo_widget_bot, if (bot == null) View.GONE else View.VISIBLE)
  if (bot == null) {
    views.setOnClickPendingIntent(R.id.rakazo_widget_root, openApp(context))
  } else {
    bindBot(views, copy, bot)
    views.setOnClickPendingIntent(R.id.rakazo_widget_root, openChat(context, bot))
  }
  return views
}

private fun bindBot(views: RemoteViews, copy: Context, bot: BotWidgetBot) {
  views.setTextViewText(R.id.rakazo_widget_initial, initialOf(bot.botName))
  views.setInt(R.id.rakazo_widget_avatar, "setColorFilter", BOT_COLORS[Math.floorMod(bot.botId.hashCode(), BOT_COLORS.size)])
  views.setTextViewText(
    R.id.rakazo_widget_name,
    if (bot.groupName == null) bot.botName else "${bot.botName}, ${bot.groupName}",
  )
  views.setTextViewText(R.id.rakazo_widget_task, bot.task)
  views.setViewVisibility(R.id.rakazo_widget_task, if (bot.task.isBlank()) View.GONE else View.VISIBLE)
  views.setTextViewText(
    R.id.rakazo_widget_state,
    copy.getString(
      when (bot.state) {
        BotWidgetState.WAITING -> R.string.rakazo_widget_needs_you
        BotWidgetState.WORKING -> R.string.rakazo_live_working
        BotWidgetState.DONE -> R.string.rakazo_widget_done
        BotWidgetState.IDLE -> R.string.rakazo_widget_idle
      },
    ),
  )
  views.setTextColor(
    R.id.rakazo_widget_state,
    copy.getColor(
      when (bot.state) {
        BotWidgetState.WAITING -> R.color.rakazo_widget_waiting
        BotWidgetState.WORKING -> R.color.rakazo_widget_working
        BotWidgetState.DONE -> R.color.rakazo_widget_done
        BotWidgetState.IDLE -> R.color.rakazo_widget_muted
      },
    ),
  )
}

/** The name's first character, whole even when it is an emoji or another surrogate pair. */
internal fun initialOf(name: String): String {
  val trimmed = name.trim()
  if (trimmed.isEmpty()) return "?"
  return String(Character.toChars(trimmed.codePointAt(0))).uppercase()
}

private fun openApp(context: Context): PendingIntent {
  val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    ?: Intent(Intent.ACTION_VIEW, Uri.parse("rakazo://")).setPackage(context.packageName)
  intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
  return PendingIntent.getActivity(
    context,
    0,
    intent,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
}

private fun openChat(context: Context, bot: BotWidgetBot): PendingIntent {
  val intent = Intent(
    Intent.ACTION_VIEW,
    Uri.parse(chatLink(bot.spaceId, bot.botId, bot.botName, bot.groupId, bot.groupName, bot.threadId)),
  )
    .setPackage(context.packageName)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
  return PendingIntent.getActivity(
    context,
    "widget:${bot.groupId.orEmpty()}:${bot.botId}".hashCode(),
    intent,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
}
