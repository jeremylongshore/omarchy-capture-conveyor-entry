import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
// Qt 6.12 adds its own Color type, so Omarchy's palette singleton must be
// qualified (docs/omarchy-shell.md, Theme tokens).
import qs.Commons as Commons
import qs.Ui
import "Model.js" as Model

// A local inbox for screenshots saved by Omarchy. It never observes the
// clipboard, uploads an image, or OCRs an existing capture without a click.
Panel {
  id: root
  moduleName: "io.github.jeremylongshore.capture-conveyor"
  ipcTarget: "io.github.jeremylongshore.capture-conveyor"
  manageIpc: false

  property var anchorItem: null
  property bool openedFromHotkey: false
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root
  readonly property string scannerPath: Qt.resolvedUrl("bin/capture-conveyor-scan").toString().replace(/^file:\/\//, "")
  readonly property int refreshSec: 20
  property var rows: []
  property string captureDirectory: ""
  property bool scanTruncated: false
  property bool scanBudgetHit: false
  property string scanReason: ""
  property bool loaded: false
  property string selectedPath: ""
  property string actionStatus: ""
  property double nowMs: Date.now()
  readonly property bool isAlert: loaded && rows.length > 0
  readonly property string label: loaded ? Model.pillText(rows) : "CAPTURE"
  readonly property string tooltip: loaded ? Model.tooltipText(rows) : "Scanning Omarchy captures…"
  readonly property string scanNotice: loaded ? Model.scanNotice(captureDirectory, scanReason, scanBudgetHit, scanTruncated, rows.length) : ""

  function open() { openedFromHotkey = false; root.controller.show(); root.refresh() }
  function openFromHotkey() { openedFromHotkey = true; root.controller.show(); root.refresh() }
  function close() { root.controller.hide() }
  function toggle() { if (root.opened) root.close(); else root.openFromHotkey() }
  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function") return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }
  function refresh() { root.nowMs = Date.now(); if (!scanProc.running) scanProc.running = true }
  function runAction(argv) { if (!actionProc.running) { root.actionStatus = ""; actionProc.command = argv; actionProc.running = true } }
  function capture() { root.runAction(["omarchy", "capture", "screenshot", "smart"]); refreshLater.restart() }
  function copyPath() { if (root.selectedPath !== "") root.runAction(["wl-copy", "--type", "text/plain", root.selectedPath]) }
  function reveal() { if (root.captureDirectory !== "") root.runAction(["xdg-open", root.captureDirectory]) }
  function selectText() { root.runAction(["omarchy", "capture", "text"]); refreshLater.restart() }
  function moveSelection(delta) {
    if (!root.rows.length) { root.selectedPath = ""; return }
    var index = 0
    for (var i = 0; i < root.rows.length; i++) if (root.rows[i].path === root.selectedPath) index = i
    index = (index + delta + root.rows.length) % root.rows.length
    root.selectedPath = root.rows[index].path
  }

  Process {
    id: scanProc
    command: [root.scannerPath]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parsed = Model.parseCaptures(text, root.nowMs)
        root.rows = parsed.captures
        root.captureDirectory = parsed.directory
        root.scanTruncated = parsed.truncated
        root.scanBudgetHit = parsed.budgetHit
        root.scanReason = parsed.reason
        root.selectedPath = Model.nextSelection(root.rows, root.selectedPath)
        root.loaded = true
      }
    }
  }

  Process { id: actionProc; command: []; onExited: function(code) { root.actionStatus = code === 0 ? "" : "ACTION FAILED • CHECK COMMAND"; root.refresh() } }
  Timer { interval: root.refreshSec * 1000; running: true; repeat: true; triggeredOnStart: true; onTriggered: root.refresh() }
  Timer { id: refreshLater; interval: 2500; repeat: false; onTriggered: root.refresh() }
  Timer { interval: 30000; running: true; repeat: true; onTriggered: root.nowMs = Date.now() }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.openFromHotkey() }
    function close(): void { root.close() }
    function show(): void { root.openFromHotkey() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): void {
      if (root.hostWidget && typeof root.hostWidget.broadcast === "function") root.hostWidget.broadcast("refresh")
      else root.refresh()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(560))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      // PanelKeyCatcher already handles Esc and Tab and turns arrows and j/k into
      // moveRequested, Return and Space into activateRequested, and any other
      // single character into textKey. Wiring those signals, instead of
      // overriding Keys.onPressed, keeps the catcher's own handling intact.
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) { if (dy !== 0) root.moveSelection(dy) }
      onActivateRequested: function(modifiers) { root.copyPath() }
      onTextKey: function(typed, modifiers) {
        if (modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier)) return
        var key = typed.toLowerCase()
        if (key === "n") root.capture()
        else if (key === "o") root.selectText()
        else if (key === "c") root.copyPath()
        else if (key === "r") root.reveal()
      }
      Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: contentColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height
        Column {
          id: contentColumn
          width: parent.width
          spacing: Style.space(8)
          PanelHero {
            title: Model.heroTitle(root.loaded, root.rows.length, root.scanReason, root.scanBudgetHit)
            meta: !root.loaded ? "Local screenshot metadata only. No clipboard or image leaves this device."
              : (root.rows.length ? "Saved by Omarchy. Select one to copy its path or reveal its folder."
                 : "Nothing to select yet.")
            foreground: root.bar ? root.bar.foreground : Commons.Color.foreground
            fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
          }
          Text {
            visible: root.scanNotice !== ""
            x: Style.space(16); width: parent.width - Style.space(32)
            text: root.scanNotice; textFormat: Text.PlainText
            wrapMode: Text.WordWrap; maximumLineCount: 3; elide: Text.ElideRight
            color: root.scanReason !== "" || root.scanBudgetHit ? Commons.Color.urgent : (root.bar ? Qt.darker(root.bar.foreground, 1.35) : Commons.Color.muted)
            font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption
          }
          Column {
            visible: root.loaded && root.rows.length > 0
            width: parent.width
            spacing: Style.space(2)
            PanelSeparator { foreground: root.bar ? root.bar.foreground : Commons.Color.foreground }
            Repeater {
              model: root.rows
              Rectangle {
                required property var modelData
                width: contentColumn.width - Style.space(32)
                x: Style.space(16)
                height: Style.space(38)
                radius: Style.space(4)
                readonly property bool selected: root.selectedPath === modelData.path
                readonly property real rowHue: Model.captureHue(modelData.path)
                color: Qt.hsla(rowHue, 0.46, 0.50, selected ? 0.18 : 0.07)
                border.color: Qt.hsla(rowHue, 0.55, 0.65, selected ? 0.85 : 0.30)
                Accessible.role: Accessible.Button
                Accessible.name: "Select capture " + modelData.name
                Text {
                  anchors.left: parent.left; anchors.leftMargin: Style.space(12); anchors.verticalCenter: parent.verticalCenter
                  text: modelData.name; textFormat: Text.PlainText; width: parent.width * 0.70; elide: Text.ElideRight
                  color: parent.selected ? Commons.Color.accent : (root.bar ? root.bar.foreground : Commons.Color.foreground)
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.body; font.bold: parent.selected
                }
                Text {
                  anchors.right: parent.right; anchors.rightMargin: Style.space(16); anchors.verticalCenter: parent.verticalCenter
                  text: modelData.age; textFormat: Text.PlainText; width: parent.width * 0.22; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
                  color: root.bar ? Qt.darker(root.bar.foreground, 1.35) : Commons.Color.muted
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption
                }
                MouseArea {
                  anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor
                  acceptedButtons: Qt.LeftButton | Qt.MiddleButton | Qt.RightButton
                  onClicked: function(mouse) {
                    root.selectedPath = modelData.path
                    if (mouse.button === Qt.MiddleButton || mouse.button === Qt.RightButton) root.copyPath()
                  }
                }
              }
            }
          }
          PanelSeparator { foreground: root.bar ? root.bar.foreground : Commons.Color.foreground }
          Row {
            width: parent.width - Style.space(32); x: Style.space(16); spacing: Style.space(10)
            Repeater {
              model: [
                { label: "NEW CAPTURE", name: "Start a new Omarchy screenshot", hue: 0.43, enabled: true, run: function() { root.capture() } },
                { label: "OCR SELECT", name: "Extract text from a new screen selection", hue: 0.76, enabled: true, run: function() { root.selectText() } }
              ]
              Rectangle {
                required property var modelData
                width: (parent.width - parent.spacing) / 2; height: Style.space(44); radius: Style.space(4)
                color: Qt.hsla(modelData.hue, 0.48, 0.50, 0.13); border.color: Qt.hsla(modelData.hue, 0.55, 0.66, 0.72)
                Accessible.role: Accessible.Button; Accessible.name: modelData.name
                Text { anchors.centerIn: parent; text: modelData.label; textFormat: Text.PlainText; width: parent.width - Style.space(12); horizontalAlignment: Text.AlignHCenter; elide: Text.ElideRight; color: Commons.Color.accent; font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption; font.bold: true; font.letterSpacing: 1 }
                MouseArea { anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: modelData.run() }
              }
            }
          }
          Row {
            width: parent.width - Style.space(32); x: Style.space(16); spacing: Style.space(10)
            Repeater {
              model: [
                { label: "COPY PATH", name: "Copy selected screenshot path", run: function() { root.copyPath() } },
                { label: "REVEAL FOLDER", name: "Reveal screenshot folder", run: function() { root.reveal() } }
              ]
              Rectangle {
                required property var modelData
                readonly property bool actionEnabled: modelData.label !== "COPY PATH" || root.selectedPath !== ""
                width: (parent.width - parent.spacing) / 2; height: Style.space(34); radius: Style.space(4)
                color: "transparent"; border.color: root.bar ? Qt.darker(root.bar.foreground, 1.45) : Commons.Color.muted; opacity: actionEnabled ? 1 : 0.45
                Accessible.role: Accessible.Button; Accessible.name: modelData.name
                Text { anchors.centerIn: parent; text: modelData.label; textFormat: Text.PlainText; width: parent.width - Style.space(12); horizontalAlignment: Text.AlignHCenter; elide: Text.ElideRight; color: root.bar ? Qt.darker(root.bar.foreground, 1.20) : Commons.Color.muted; font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption; font.bold: true }
                MouseArea { anchors.fill: parent; enabled: parent.actionEnabled; hoverEnabled: true; cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor; onClicked: modelData.run() }
              }
            }
          }
          Text {
            visible: root.loaded; anchors.left: parent.left; anchors.leftMargin: Style.space(16)
            text: "UP/DOWN select  •  ENTER or C copy path  •  N new  •  O OCR  •  R reveal"
            textFormat: Text.PlainText; width: parent.width - Style.space(32); elide: Text.ElideRight
            color: root.bar ? Qt.darker(root.bar.foreground, 1.35) : Commons.Color.muted; font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption
          }
          Text {
            visible: root.actionStatus !== ""; text: root.actionStatus; textFormat: Text.PlainText
            width: parent.width - Style.space(32); x: Style.space(16); elide: Text.ElideRight
            color: Commons.Color.urgent; font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption; font.bold: true
          }
          Item { width: 1; height: Style.space(4) }
        }
      }
    }
  }
}
