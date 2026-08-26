import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
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
  property bool loaded: false
  property string selectedPath: ""
  property double nowMs: Date.now()
  readonly property bool isAlert: loaded && rows.length > 0
  readonly property string label: loaded ? Model.pillText(rows) : "CAPTURE"
  readonly property string tooltip: loaded ? Model.tooltipText(rows) : "Scanning Omarchy captures…"

  function open() { openedFromHotkey = false; root.controller.show(); root.refresh() }
  function openFromHotkey() { openedFromHotkey = true; root.controller.show(); root.refresh() }
  function close() { root.controller.hide() }
  function toggle() { if (root.opened) root.close(); else root.openFromHotkey() }
  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function") return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }
  function refresh() { root.nowMs = Date.now(); if (!scanProc.running) scanProc.running = true }
  function runAction(argv) { if (!actionProc.running) { actionProc.command = argv; actionProc.running = true } }
  function capture() { root.runAction(["omarchy", "capture", "screenshot", "smart"]); refreshLater.restart() }
  function annotate() { if (root.selectedPath !== "") root.runAction(["tensaku-edit", root.selectedPath]) }
  function copyPath() { if (root.selectedPath !== "") root.runAction(["wl-copy", "--type", "text/plain", root.selectedPath]) }
  function reveal() { if (root.captureDirectory !== "") root.runAction(["xdg-open", root.captureDirectory]) }
  function selectText() { root.runAction(["omarchy", "capture", "text"]); refreshLater.restart() }

  Process {
    id: scanProc
    command: [root.scannerPath]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parsed = Model.parseCaptures(text, root.nowMs)
        if (parsed.directory !== "") {
          root.rows = parsed.captures
          root.captureDirectory = parsed.directory
          root.scanTruncated = parsed.truncated
          root.loaded = true
          if (root.selectedPath === "" && root.rows.length) root.selectedPath = root.rows[0].path
        }
      }
    }
  }

  Process { id: actionProc; command: []; onExited: root.refresh() }
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
    contentWidth: panel.fittedContentWidth(Style.space(460))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
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
            title: !root.loaded ? "READING CAPTURES" : (root.rows.length ? root.rows.length + " RECENT CAPTURES" : "NO SAVED CAPTURES")
            meta: !root.loaded ? "Local screenshot metadata only. No clipboard or image leaves this device."
              : (root.scanTruncated ? "Showing the newest " + root.rows.length + " saved Omarchy screenshots."
                 : "Saved by Omarchy. Select one to annotate or copy its path.")
            foreground: root.bar ? root.bar.foreground : Color.foreground
            fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
          }
          Column {
            visible: root.loaded && root.rows.length > 0
            width: parent.width
            spacing: Style.space(2)
            PanelSeparator { foreground: root.bar ? root.bar.foreground : Color.foreground }
            Repeater {
              model: root.rows
              Item {
                required property var modelData
                width: contentColumn.width
                height: Style.space(30)
                readonly property bool selected: root.selectedPath === modelData.path
                Text {
                  anchors.left: parent.left; anchors.leftMargin: Style.space(16); anchors.verticalCenter: parent.verticalCenter
                  text: modelData.name; textFormat: Text.PlainText; width: parent.width * 0.72; elide: Text.ElideRight
                  color: parent.selected ? (root.bar ? root.bar.foreground : Color.foreground) : (root.bar ? Qt.darker(root.bar.foreground, 1.25) : Color.muted)
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.body
                }
                Text {
                  anchors.right: parent.right; anchors.rightMargin: Style.space(16); anchors.verticalCenter: parent.verticalCenter
                  text: modelData.age; textFormat: Text.PlainText; width: parent.width * 0.22; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
                  color: root.bar ? Qt.darker(root.bar.foreground, 1.35) : Color.muted
                  font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption
                }
                MouseArea {
                  anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor
                  acceptedButtons: Qt.LeftButton | Qt.MiddleButton | Qt.RightButton
                  onClicked: function(mouse) {
                    root.selectedPath = modelData.path
                    if (mouse.button === Qt.MiddleButton) root.annotate()
                    else if (mouse.button === Qt.RightButton) root.copyPath()
                  }
                }
              }
            }
          }
          PanelSeparator { foreground: root.bar ? root.bar.foreground : Color.foreground }
          Row {
            width: parent.width - Style.space(32); x: Style.space(16); spacing: Style.space(12)
            Repeater {
              model: [
                { label: "NEW", run: function() { root.capture() } },
                { label: "ANNOTATE", run: function() { root.annotate() } },
                { label: "COPY PATH", run: function() { root.copyPath() } },
                { label: "REVEAL", run: function() { root.reveal() } },
                { label: "OCR", run: function() { root.selectText() } }
              ]
              Text {
                required property var modelData
                text: modelData.label; textFormat: Text.PlainText
                width: Math.min(implicitWidth, parent.width / 5)
                elide: Text.ElideRight
                color: root.bar ? root.bar.foreground : Color.foreground; font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption; font.letterSpacing: 1
                MouseArea { anchors.fill: parent; hoverEnabled: true; cursorShape: Qt.PointingHandCursor; onClicked: modelData.run() }
              }
            }
          }
          Text {
            visible: root.selectedPath !== ""; anchors.left: parent.left; anchors.leftMargin: Style.space(16)
            text: "Click a capture to select it. Middle click: annotate. Right click: copy path."
            textFormat: Text.PlainText; width: parent.width - Style.space(32); elide: Text.ElideRight
            color: root.bar ? Qt.darker(root.bar.foreground, 1.35) : Color.muted; font.family: root.bar ? root.bar.fontFamily : Style.font.family; font.pixelSize: Style.font.caption
          }
          Item { width: 1; height: Style.space(4) }
        }
      }
    }
  }
}
