package com.rakazo.notifications

import org.junit.Assert.assertEquals
import org.junit.Test

class BotWidgetsTest {
  @Test
  fun `bots waiting on the user come first, then work, then finished work, one entry per chat`() {
    val bots = botWidgetBots(
      active = listOf(run("ada", "running"), run("bea", "waiting_input")),
      recent = listOf(run("ada", "completed"), run("cy", "completed"), run("dee", "failed")),
    )

    assertEquals(listOf("bea", "ada", "cy", "dee"), bots.map { it.botId })
    assertEquals(
      listOf(BotWidgetState.WAITING, BotWidgetState.WORKING, BotWidgetState.DONE, BotWidgetState.IDLE),
      bots.map { it.state },
    )
  }

  @Test
  fun `a bot in a group chat is its own entry beside its direct chat`() {
    val bots = botWidgetBots(
      active = listOf(run("ada", "running"), run("ada", "running", groupId = "team")),
      recent = emptyList(),
    )

    assertEquals(listOf(null, "team"), bots.map { it.groupId })
  }

  @Test
  fun `no widget is handed more bots than its largest size shows`() {
    val bots = botWidgetBots(active = emptyList(), recent = (1..10).map { run("bot-$it", "completed") })

    assertEquals(MAX_WIDGET_BOTS, bots.size)
  }

  @Test
  fun `saved bots read back as they were written`() {
    val bots = botWidgetBots(
      active = listOf(run("ada", "waiting_takeover", groupId = "team")),
      recent = listOf(run("bea", "completed")),
    )

    assertEquals(bots, decodeBotWidgetBots(encodeBotWidgetBots(bots)))
  }

  @Test
  fun `unreadable saved bots read as none`() {
    assertEquals(emptyList<BotWidgetBot>(), decodeBotWidgetBots("{not json"))
    assertEquals(emptyList<BotWidgetBot>(), decodeBotWidgetBots(null))
  }

  @Test
  fun `the avatar shows the name's whole first character`() {
    assertEquals("A", initialOf(" ada"))
    assertEquals("\uD83E\uDD16", initialOf("\uD83E\uDD16 Robo"))
    assertEquals("?", initialOf("  "))
  }

  private fun run(botId: String, status: String, groupId: String? = null) = RunRecord(
    runId = "$botId-$status-$groupId",
    spaceId = "space",
    botId = botId,
    botName = botId.replaceFirstChar(Char::uppercase),
    groupId = groupId,
    groupName = groupId?.let { "Team" },
    threadId = "thread-$botId",
    status = status,
    prompt = "Find a flight",
    trigger = "message",
    notificationsEnabled = true,
  )
}
