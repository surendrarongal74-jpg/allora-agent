package com.rakazo.notifications

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** What a bot is doing, as the home-screen widgets show it. */
internal enum class BotWidgetState(val wire: String) {
  WAITING("waiting"),
  WORKING("working"),
  DONE("done"),
  IDLE("idle"),
  ;

  companion object {
    fun of(wire: String) = entries.firstOrNull { it.wire == wire } ?: IDLE
  }
}

/** One bot on a widget: who it is, its latest task, and where a tap takes the user. */
internal data class BotWidgetBot(
  val botId: String,
  val botName: String,
  val groupId: String?,
  val groupName: String?,
  val spaceId: String,
  val threadId: String,
  val task: String,
  val state: BotWidgetState,
)

/** The most bots any widget size shows. */
internal const val MAX_WIDGET_BOTS = 6

/**
 * One entry per chat a bot works in: bots waiting on the user first, then those at work, then the
 * latest finished work, each in the server's order. A failed or cancelled run leaves its bot idle.
 */
internal fun botWidgetBots(active: List<RunRecord>, recent: List<RunRecord>): List<BotWidgetBot> {
  val waiting = active.filter { it.status == "waiting_input" || it.status == "waiting_takeover" }
  val chats = linkedMapOf<String, BotWidgetBot>()
  for (run in waiting + active + recent) {
    val key = "${run.groupId.orEmpty()}:${run.botId}"
    if (key in chats) continue
    chats[key] = BotWidgetBot(
      botId = run.botId,
      botName = run.botName,
      groupId = run.groupId,
      groupName = run.groupName,
      spaceId = run.spaceId,
      threadId = run.threadId,
      task = run.prompt,
      state = when (run.status) {
        "waiting_input", "waiting_takeover" -> BotWidgetState.WAITING
        "queued", "leased", "running" -> BotWidgetState.WORKING
        "completed" -> BotWidgetState.DONE
        else -> BotWidgetState.IDLE
      },
    )
    if (chats.size == MAX_WIDGET_BOTS) break
  }
  return chats.values.toList()
}

internal fun encodeBotWidgetBots(bots: List<BotWidgetBot>): String =
  JSONArray(
    bots.map { bot ->
      JSONObject()
        .put("botId", bot.botId)
        .put("botName", bot.botName)
        .put("groupId", bot.groupId ?: JSONObject.NULL)
        .put("groupName", bot.groupName ?: JSONObject.NULL)
        .put("spaceId", bot.spaceId)
        .put("threadId", bot.threadId)
        .put("task", bot.task)
        .put("state", bot.state.wire)
    },
  ).toString()

/** Bots saved by an earlier build or a torn write read as none, never as a crash in the launcher. */
internal fun decodeBotWidgetBots(json: String?): List<BotWidgetBot> {
  if (json.isNullOrBlank()) return emptyList()
  return runCatching {
    val rows = JSONArray(json)
    List(rows.length()) { index ->
      val row = rows.getJSONObject(index)
      BotWidgetBot(
        botId = row.getString("botId"),
        botName = row.getString("botName"),
        groupId = row.optString("groupId").takeUnless { row.isNull("groupId") || it.isBlank() },
        groupName = row.optString("groupName").takeUnless { row.isNull("groupName") || it.isBlank() },
        spaceId = row.getString("spaceId"),
        threadId = row.getString("threadId"),
        task = row.optString("task"),
        state = BotWidgetState.of(row.optString("state")),
      )
    }
  }.getOrDefault(emptyList())
}

/** The widgets' saved bots, kept so the launcher can draw them while the app is closed. */
internal object BotWidgets {
  private const val PREFERENCES = "rakazo.bot_widgets"
  private const val BOTS = "bots"

  private val providers = listOf(RakazoBotsWidget::class.java, RakazoBotWidget::class.java)

  /** Whether the user has put any of the bot widgets on a home screen. */
  fun placed(context: Context): Boolean {
    val manager = AppWidgetManager.getInstance(context) ?: return false
    return providers.any { manager.getAppWidgetIds(ComponentName(context, it)).isNotEmpty() }
  }

  fun read(context: Context): List<BotWidgetBot> =
    decodeBotWidgetBots(context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(BOTS, null))

  /** Saves the bots and redraws every placed widget, unless nothing they show has changed. */
  fun publish(context: Context, bots: List<BotWidgetBot>) {
    val encoded = encodeBotWidgetBots(bots)
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    if (preferences.getString(BOTS, null) == encoded) return
    preferences.edit().putString(BOTS, encoded).apply()
    redraw(context, bots)
  }

  /** Signed out: the widgets stop showing the last account's bots. */
  fun clear(context: Context) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().remove(BOTS).apply()
    redraw(context, emptyList())
  }

  private fun redraw(context: Context, bots: List<BotWidgetBot>) {
    val manager = AppWidgetManager.getInstance(context) ?: return
    for (provider in providers) {
      val single = provider == RakazoBotWidget::class.java
      for (id in manager.getAppWidgetIds(ComponentName(context, provider))) {
        drawBotWidget(context, manager, id, bots, single)
      }
    }
  }
}
