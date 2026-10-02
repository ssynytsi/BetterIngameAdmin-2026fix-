

/* FOV/sens persistence is handled in client ZoomLevel.lua via SettingsManager
   (this PC). Apply buttons already DispatchEvent Set* which Lua saves. */
function biaSaveLookLocal(patch) {
  /* no-op: WebUI:SetFieldOfView / SetMouseSensitivity* persist in Lua */
}

function biaLoadLookLocal() {
  return null;
}

function biaApplyLookLocalToGame() {
  /* Lua re-applies on Extension:Loaded / Level:Loaded */
}



var biaLookLocalApplied = false;
function biaEnsureLookLocalApplied() {
  if (biaLookLocalApplied) {
    return;
  }
  biaLookLocalApplied = true;
  biaApplyLookLocalToGame();
}


/* ==========================================================================
   BIA UI CORE (v3)
   - UI prefs (zoom, vote popup offset) persisted via client Lua + localStorage
   - UI zoom bar: -/+ buttons, drag track, mouse wheel, Fit, Reset
     (no <input type=range>: Gameface renders it as a clipped text box)
   - Keyboard ownership: click a text field -> keyboard is captured, no "J"
   - Vote popup pinned to the real screen edge at any resolution
   - Generic scroll hints (down arrow while more content, up arrow once scrolled)
   ========================================================================== */
var BIA_ZOOM_MIN = 0.5;
var BIA_ZOOM_MAX = 1.8;
var BIA_ZOOM_STEP = 0.05;
var biaPrefs = { zoom: 1.3, voteX: 8, voteY: 38, lang: "en", pinMe: false };
var biaUiZoom = 1.3;
var biaPrefsTimer = null;

function biaById(id) {
  return document.getElementById(id);
}
function biaClamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function biaEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function biaPrefsMerge(p) {
  if (!p || typeof p !== "object") return;
  if (p.zoom != null && !isNaN(+p.zoom)) biaPrefs.zoom = biaClamp(+p.zoom, BIA_ZOOM_MIN, BIA_ZOOM_MAX);
  if (p.voteX != null && !isNaN(+p.voteX)) biaPrefs.voteX = biaClamp(+p.voteX, 0, 4000);
  if (p.voteY != null && !isNaN(+p.voteY)) biaPrefs.voteY = biaClamp(+p.voteY, 0, 95);
  if (typeof p.lang === "string") biaPrefs.lang = p.lang;
  if (p.pinMe != null) biaPrefs.pinMe = p.pinMe === true;
}
function biaPrefsLoadLocal() {
  try {
    if (window.localStorage) {
      var s = window.localStorage.getItem("biaUiPrefs");
      if (s) biaPrefsMerge(JSON.parse(s));
    }
  } catch (e) {}
  biaUiZoom = biaPrefs.zoom;
}
function biaPrefsSave() {
  if (biaPrefsTimer !== null) clearTimeout(biaPrefsTimer);
  biaPrefsTimer = setTimeout(function () {
    biaPrefsTimer = null;
    var s = JSON.stringify(biaPrefs);
    try {
      if (window.localStorage) window.localStorage.setItem("biaUiPrefs", s);
    } catch (e) {}
    try {
      WebUI.Call("DispatchEvent", "WebUI:BiaSaveUiPrefs", s);
    } catch (e) {}
  }, 500);
}
/* Called by ext/Client/BiaExtras.lua with the string it stored on this PC */
function biaRestoreUiPrefs(p) {
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch (e) {
      p = null;
    }
  }
  biaPrefsMerge(p);
  biaUiZoom = biaPrefs.zoom;
  var sb = biaById("scoreboard");
  if (sb && sb.style.display === "flex") biaApplyUiZoom(biaUiZoom, true);
  biaUpdateZoomReadout();
  biaPositionVotePopup();
  biaApplyLang();
}

/* --- zoom --------------------------------------------------------------- */
function biaEnsureUiTree() {
  // Keep tabs + tables in one scaled root so zoom never misaligns them
  var sb = biaById("scoreboard");
  var tb = biaById("tables");
  if (sb && tb && tb.parentNode !== sb) {
    sb.appendChild(tb);
  }
  var bar = biaById("biaZoomBar");
  var tabs = biaById("headertabs");
  if (bar && tabs && sb && bar.parentNode === sb && bar.nextSibling !== tabs) {
    sb.insertBefore(bar, tabs);
  }
}
function biaApplyUiZoom(z, noSave) {
  z = Number(z);
  if (isNaN(z)) z = 1.3;
  z = Math.round(biaClamp(z, BIA_ZOOM_MIN, BIA_ZOOM_MAX) * 100) / 100;
  biaUiZoom = z;
  biaPrefs.zoom = z;
  biaEnsureUiTree();
  var sb = biaById("scoreboard");
  if (sb) {
    sb.style.transform = "scale(" + z + ")";
    sb.style.transformOrigin = "50% 0%";
  }
  var tb = biaById("tables");
  if (tb) tb.style.transform = "none";
  biaUpdateZoomReadout();
  if (!noSave) biaPrefsSave();
  setTimeout(biaRefreshAllHints, 30);
}
function biaZoomFrac(z) {
  return (z - BIA_ZOOM_MIN) / (BIA_ZOOM_MAX - BIA_ZOOM_MIN);
}
function biaUpdateZoomReadout(previewZ) {
  var z = previewZ != null ? previewZ : biaUiZoom;
  var label = biaById("biaZoomVal");
  if (label) label.textContent = z.toFixed(2) + "x";
  var fill = biaById("biaZoomFill");
  var knob = biaById("biaZoomKnob");
  var pct = Math.round(biaZoomFrac(z) * 1000) / 10;
  if (fill) fill.style.width = pct + "%";
  if (knob) knob.style.left = pct + "%";
  var res = biaById("biaResVal");
  if (res) {
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    res.textContent = w && h ? w + "x" + h : "";
  }
}
function biaZoomStep(dir) {
  biaApplyUiZoom(biaUiZoom + dir * BIA_ZOOM_STEP);
}
function biaZoomReset() {
  biaApplyUiZoom(1.3);
}
/* Fit: scale so the whole menu (tabs + active panel) fills ~92% of the screen */
function biaZoomFit() {
  var sb = biaById("scoreboard");
  if (!sb) return;
  var r = sb.getBoundingClientRect();
  var vw = window.innerWidth || 1920;
  var vh = window.innerHeight || 1080;
  if (!r || r.width < 10 || r.height < 10) return;
  var availH = vh - Math.max(0, r.top) - vh * 0.04;
  var f = Math.min(availH / r.height, (vw * 0.94) / r.width);
  biaApplyUiZoom(biaUiZoom * f);
}
var biaZoomDrag = null;
function biaZoomTrackDown(e) {
  var track = biaById("biaZoomTrack");
  if (!track) return;
  var r = track.getBoundingClientRect();
  biaZoomDrag = { left: r.left, width: r.width || 1, z: biaUiZoom };
  biaZoomDragMove(e);
  if (e && e.preventDefault) e.preventDefault();
}
function biaZoomDragMove(e) {
  if (!biaZoomDrag || !e) return;
  var f = biaClamp((e.clientX - biaZoomDrag.left) / biaZoomDrag.width, 0, 1);
  var z = BIA_ZOOM_MIN + f * (BIA_ZOOM_MAX - BIA_ZOOM_MIN);
  z = Math.round(z / BIA_ZOOM_STEP) * BIA_ZOOM_STEP;
  biaZoomDrag.z = z;
  // preview only: applying scale mid-drag would move the track under the mouse
  biaUpdateZoomReadout(z);
}
document.addEventListener("mousemove", function (e) {
  if (biaZoomDrag) biaZoomDragMove(e);
});
document.addEventListener("mouseup", function () {
  if (biaZoomDrag) {
    var z = biaZoomDrag.z;
    biaZoomDrag = null;
    biaApplyUiZoom(z);
  }
});
function biaEnsureZoomBar() {
  var bar = biaById("biaZoomBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "biaZoomBar";
    bar.innerHTML =
      '<div class="biaZoomLabel">UI Zoom</div>' +
      '<div class="biaZoomBtn biaTipBtn" data-tip="Smaller" onmousedown="biaHold(event, biaZoomStep, -1)">-</div>' +
      '<div id="biaZoomTrack" onmousedown="biaZoomTrackDown(event)"><div id="biaZoomFill"></div><div id="biaZoomKnob"></div></div>' +
      '<div class="biaZoomBtn biaTipBtn" data-tip="Bigger" onmousedown="biaHold(event, biaZoomStep, 1)">+</div>' +
      '<div id="biaZoomVal">1.30x</div>' +
      '<div class="biaZoomBtn wide biaTipBtn" data-tip="Scale the menu to fit this screen" onclick="biaZoomFit()">Fit</div>' +
      '<div class="biaZoomBtn wide biaTipBtn" data-tip="Back to 1.30x" onclick="biaZoomReset()">Reset</div>' +
      '<div class="biaZoomSep"></div>' +
      '<div class="biaZoomLabel">Vote popup</div>' +
      '<div class="biaZoomBtn biaTipBtn" data-tip="Move vote popup left (hold to keep moving)" onmousedown="biaHold(event, biaVoteNudge, -1, 0)">&lt;</div>' +
      '<div class="biaZoomBtn biaTipBtn" data-tip="Move vote popup right" onmousedown="biaHold(event, biaVoteNudge, 1, 0)">&gt;</div>' +
      '<div class="biaZoomBtn biaTipBtn" data-tip="Move vote popup up" onmousedown="biaHold(event, biaVoteNudge, 0, -1)">^</div>' +
      '<div class="biaZoomBtn biaTipBtn" data-tip="Move vote popup down" onmousedown="biaHold(event, biaVoteNudge, 0, 1)">v</div>' +
      '<div class="biaZoomBtn wide biaTipBtn" data-tip="Show a dummy vote popup for 5s so you can place it" onclick="biaVotePreview()">Test</div>' +
      '<div id="biaResVal"></div>' +
      '<div class="biaZoomSep"></div>' +
      '<div id="biaLangWrap">' + biaLangPickerHtml() + "</div>";
    bar.addEventListener("wheel", function (e) {
      var d = e.deltaY || e.detail || 0;
      if (d) biaZoomStep(d > 0 ? -1 : 1);
      if (e.preventDefault) e.preventDefault();
    });
    var sb = biaById("scoreboard");
    var tabs = biaById("headertabs");
    if (sb && tabs) {
      sb.insertBefore(bar, tabs);
    } else {
      document.body.appendChild(bar);
    }
    try {
      biaBindTooltips(bar);
    } catch (e) {}
  }
  bar.style.display = "flex";
  biaUpdateZoomReadout();
  biaApplyLang();
}
function biaHideZoomBar() {
  var bar = biaById("biaZoomBar");
  if (bar) bar.style.display = "none";
}
/* kept for any old inline handler still pointing at it */
function biaZoomFocus(on) {}

/* --- keyboard ownership --------------------------------------------------
   Gameface: WebUI.Call("EnableKeyboard") alone is not reliable, which is why
   the chat key ("J") had to be pressed first (and then both the chat and the
   field got the keys). Every toggle also goes to ext/Client/BiaExtras.lua,
   which calls WebUI:EnableKeyboard() from Lua and blocks game UI hotkeys
   (chat, etc.) while a field is being typed in.
   Rules: click a text field -> keyboard on. Click anything else, Enter or
   Esc -> keyboard off. A spurious blur (Gameface re-focusing the view) is
   undone automatically, so you never have to click back after each key. */
var biaKbOn = false;
var biaKbField = null;
var biaKbLastDown = 0;
var biaKbRefocus = { t: 0, n: 0 };

function biaIsTextField(t) {
  if (!t || !t.tagName) return false;
  var tag = t.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  var ty = (t.getAttribute("type") || "text").toLowerCase();
  return ty === "text" || ty === "password" || ty === "search";
}
function biaKb(on) {
  on = !!on;
  if (!on) biaKbField = null;
  if (on === biaKbOn) return;
  biaKbOn = on;
  try {
    WebUI.Call(on ? "EnableKeyboard" : "ResetKeyboard");
  } catch (e) {}
  if (on) {
    try {
      WebUI.Call("EnableMouse");
    } catch (e) {}
  }
  try {
    WebUI.Call("DispatchEvent", "WebUI:BiaKeyboard", on ? "1" : "0");
  } catch (e) {}
}
function biaKbTake(el) {
  if (!el) return;
  biaKbField = el;
  biaKb(true);
  try {
    if (document.activeElement !== el) el.focus();
  } catch (e) {}
}
function biaKbRelease() {
  var f = biaKbField;
  biaKbField = null;
  if (f) {
    try {
      f.blur();
    } catch (e) {}
  }
  biaKb(false);
}
/* Popups with a reason/duration box: focus it so you can type straight away */
function biaKbPopupOpen() {
  setTimeout(function () {
    var pop = biaById("popup");
    if (!pop) return;
    var inputs = pop.getElementsByTagName("input");
    var pick = null;
    for (var i = 0; i < inputs.length; i++) {
      var id = inputs[i].id || "";
      if (id.indexOf("Reason") !== -1 || id.indexOf("Duration") !== -1) {
        pick = inputs[i];
        break;
      }
    }
    if (pick) biaKbTake(pick);
  }, 40);
}
function biaInstallInputFocusHooks() {
  if (window._biaFocusHooks) return;
  window._biaFocusHooks = true;
  document.addEventListener(
    "mousedown",
    function (e) {
      biaKbLastDown = Date.now();
      var t = e.target;
      if (biaIsTextField(t)) {
        biaKbTake(t);
      } else if (biaKbField) {
        biaKbRelease();
      }
    },
    true
  );
  document.addEventListener(
    "focusin",
    function (e) {
      if (biaIsTextField(e.target)) biaKbTake(e.target);
    },
    true
  );
  document.addEventListener(
    "focusout",
    function (e) {
      var el = e.target;
      if (!el || el !== biaKbField) return;
      // a real click elsewhere already released us; anything else is a
      // spurious blur (re-layout, view refocus) -> put the caret back
      if (Date.now() - biaKbLastDown < 120) return;
      setTimeout(function () {
        if (biaKbField !== el || document.activeElement === el) return;
        if (!el.parentNode || el.offsetParent === null) {
          biaKbRelease();
          return;
        }
        var now = Date.now();
        if (now - biaKbRefocus.t > 1000) biaKbRefocus = { t: now, n: 0 };
        biaKbRefocus.n++;
        if (biaKbRefocus.n > 6) return; // never fight a real focus change forever
        try {
          el.focus();
        } catch (err) {}
      }, 0);
    },
    true
  );
  document.addEventListener(
    "keydown",
    function (e) {
      if (!biaKbField) return;
      var k = e.key || "";
      var code = e.keyCode || e.which || 0;
      if (k === "Escape" || code === 27) {
        biaKbRelease();
      } else if (k === "Enter" || code === 13) {
        var f = biaKbField;
        var act = f && f.getAttribute("data-bia-enter");
        if (act && typeof window[act] === "function") {
          try {
            window[act]();
          } catch (err) {}
        }
        biaKbRelease();
      }
    },
    true
  );
}
biaInstallInputFocusHooks();

/* --- vote popup: pinned to the REAL screen, any resolution ----------------
   body carries transform: scale(), so position:fixed/absolute children resolve
   against body's box, not the viewport. Convert screen px -> body-local px. */
function biaPositionVotePopup() {
  var el = biaById("votepopup");
  if (!el || !document.body) return;
  if (el.parentNode !== document.body) document.body.appendChild(el);
  var body = document.body;
  var br = body.getBoundingClientRect();
  var bw = body.offsetWidth || 1074;
  var s = br.width / bw;
  if (!s || s < 0.05) s = 1;
  var vw = window.innerWidth || 1920;
  var vh = window.innerHeight || 1080;
  var pw = (el.offsetWidth || 230) * s;
  var ph = (el.offsetHeight || 90) * s;
  var x = biaClamp(biaPrefs.voteX, 0, Math.max(0, vw - pw));
  var y = biaClamp((vh * biaPrefs.voteY) / 100, 0, Math.max(0, vh - ph));
  el.style.position = "absolute";
  el.style.left = (x - br.left) / s + "px";
  el.style.top = (y - br.top) / s + "px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.margin = "0px";
  el.style.transform = "none";
  el.style.zIndex = "9999";
}
/* old name, still called by the vote code */
function biaPinVotePopup() {
  biaPositionVotePopup();
}
function biaVoteNudge(dx, dy) {
  biaPrefs.voteX = biaClamp(biaPrefs.voteX + dx * 8, 0, 4000);
  biaPrefs.voteY = biaClamp(biaPrefs.voteY + dy * 1, 0, 95);
  biaPositionVotePopup();
  biaPrefsSave();
  biaVotePreview(true);
}
var biaPreviewTimer = null;
function biaVotePreview(keepText) {
  if (isVoteInProgress || biaMapVoteActive) {
    biaPositionVotePopup();
    return;
  }
  var pop = biaById("votepopup");
  if (!pop) return;
  if (!keepText || !pop.classList.contains("shown")) {
    biaById("votetitleleft").innerHTML = "<p>Vote popup position</p>";
    biaById("votetitleright").innerHTML = "<p>5 sec</p>";
    biaById("countyesvotes").innerHTML = "0 Y";
    biaById("countnovotes").innerHTML = "0 N";
  }
  pop.classList.add("shown");
  biaPositionVotePopup();
  if (biaPreviewTimer) clearTimeout(biaPreviewTimer);
  biaPreviewTimer = setTimeout(function () {
    biaPreviewTimer = null;
    if (!isVoteInProgress && !biaMapVoteActive) pop.classList.remove("shown");
  }, 5000);
}
window.addEventListener("resize", function () {
  biaPositionVotePopup();
  biaUpdateZoomReadout();
  biaRefreshAllHints();
});

/* --- scroll hints -----------------------------------------------------------
   Down arrow: shown whenever the list overflows (dimmed at the very bottom).
   Up arrow: appears once scrolled down, gone only at the very top.
   Both are clickable (page up / page down). CSS triangles, no font glyphs. */
var biaHintTargets = {};
function biaHintScroll(scrollId, dir) {
  var el = biaById(scrollId);
  if (!el) return;
  var step = Math.max(28, Math.round((el.clientHeight || 200) * 0.8));
  el.scrollTop = Math.max(0, (el.scrollTop || 0) + dir * step);
  setTimeout(function () {
    biaRefreshHints(scrollId);
  }, 20);
}
function biaRefreshHints(scrollId) {
  var el = biaById(scrollId);
  var t = biaHintTargets[scrollId];
  if (!el || !t) return;
  var down = biaById(t.down);
  var up = biaById(t.up);
  if (!down || !up) return;
  var st = el.scrollTop || 0;
  var max = (el.scrollHeight || 0) - (el.clientHeight || 0);
  var overflow = max > 3;
  down.style.display = overflow ? "flex" : "none";
  down.style.opacity = overflow && st >= max - 3 ? "0.3" : "1";
  up.style.display = overflow && st > 3 ? "flex" : "none";
}
function biaRefreshAllHints() {
  for (var id in biaHintTargets) {
    if (biaHintTargets.hasOwnProperty(id)) biaRefreshHints(id);
  }
}
/* scrollId: element that scrolls. hostId: positioned element to draw into.
   side: "left" | "right" (outside edge of host). */
function biaAttachHints(scrollId, hostId, side) {
  var el = biaById(scrollId);
  var host = biaById(hostId);
  if (!el || !host) return;
  var boxId = scrollId + "Hints";
  var box = biaById(boxId);
  if (!box || box.parentNode !== host) {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = document.createElement("div");
    box.id = boxId;
    box.className = "biaHintBox " + (side === "right" ? "biaHintRight" : "biaHintLeft");
    box.innerHTML =
      '<div id="' + boxId + 'Down" class="biaScrollHint biaScrollDown" onmousedown="biaHintScroll(\'' + scrollId + '\',1)"></div>' +
      '<div id="' + boxId + 'Up" class="biaScrollHint biaScrollUp" onmousedown="biaHintScroll(\'' + scrollId + '\',-1)"></div>';
    host.appendChild(box);
  }
  biaHintTargets[scrollId] = { down: boxId + "Down", up: boxId + "Up" };
  if (el._biaHintBound !== true) {
    el._biaHintBound = true;
    el.addEventListener("scroll", function () {
      biaRefreshHints(scrollId);
    });
    el.addEventListener("wheel", function () {
      setTimeout(function () {
        biaRefreshHints(scrollId);
      }, 40);
    });
  }
  biaRefreshHints(scrollId);
}

biaPrefsLoadLocal();

/* --- press-and-hold auto-repeat for small step buttons ----------------------
   First step fires on press, then repeats after 350ms, accelerating. Stops on
   mouseup anywhere, or when the GUI closes. */
var biaHoldState = null;
function biaHoldStop() {
  if (!biaHoldState) return;
  clearTimeout(biaHoldState.timer);
  biaHoldState = null;
}
function biaHold(e, fn, a, b) {
  biaHoldStop();
  if (e && e.button != null && e.button !== 0) return;
  if (e && e.preventDefault) e.preventDefault();
  fn(a, b);
  var state = { timer: null, n: 0 };
  biaHoldState = state;
  function tick() {
    if (biaHoldState !== state) return;
    fn(a, b);
    state.n++;
    state.timer = setTimeout(tick, state.n < 8 ? 90 : 40);
  }
  state.timer = setTimeout(tick, 350);
}
document.addEventListener("mouseup", biaHoldStop);
window.addEventListener("blur", biaHoldStop);


function biaShowLookHint(show) {
  var el = document.getElementById("lookSettingsHint");
  if (!el) return;
  if (show) {
    el.classList.add("open");
  } else {
    el.classList.remove("open");
  }
}

/* Region IsAdmin */
isOwner = false;
admin = false;
canMovePlayers = false;
canKillPlayers = false;
canKickPlayers = false;
canTemporaryBanPlayers = false;
canPermanentlyBanPlayers = false;
canEditGameAdminList = false;
canEditBanList = false;
canEditMapList = false;
canUseMapFunctions = false;
canAlterServerSettings = false;
canEditReservedSlotsList = false;
canEditTextChatModerationList = false;
canShutdownServer = false;
/* Endregion */

/* Region Mute */
playersMuted = [];
channelsMuted = [];
adminChannel = false;
allChannel = false;
teamChannel = false;
squadChannel = false;
/* Endregion */

/* Region Scoreboard Place */
place1 = 0;
place2 = 0;
place3 = 0;
place4 = 0;
/* Endregion */

/* Region Votings */
novotes = 0;
yesvotes = 0;
secondsLeft = 0;
isVoteInProgress = false;
/* Endregion */

/* Region SquadCount */
const squadCount = [];
maxSquadSize = 4;
/* Endregion */

/* Region Local Player */
localPlayer = "";
localPlayerSquad = 9999;
localPlayerIsSquadLeader = false;
localPlayerIsSquadPrivate = false;
localPing = "–";
/* Endregion */

/* Region Client Settings */
toggleScoreboard = false;
showHideVotings = true;
showPing = false;
/* Endregion */

/* Region Admin actions for player */
teamIdToSwitch = "1";
teamNameToSwitch = "Team US";
squadIdToSwitch = "0";
squadNameToSwitch = "No Squad";
playerCanMovePlayers = false;
playerCanKillPlayers = false;
playerCanKickPlayers = false;
playerCanTemporaryBanPlayers = false;
playerCanPermanentlyBanPlayers = false;
playerCanEditGameAdminList = false;
playerCanEditBanList = false;
playerCanEditMapList = false;
playerCanUseMapFunctions = false;
playerCanAlterServerSettings = false;
playerCanEditReservedSlotsList = false;
playerCanEditTextChatModerationList = false;
playerCanShutdownServer = false;
/* Endregion */

/* Region presets */
varsPresetNormal = true;
varsPresetInfantry = true;
varsPresetHardcore = true;
varsPresetHardcoreNoMap = true;
/* Endregion */

/* Region Assist */
isInAssistQueue = false;
enableAssistFunction = true;
/* Endregion */

/* Region PopUp (gets triggered on click on playerName on scoreboard */
function action(playerName, squadId, isSquadPrivate) {
  let playerNameInline = playerName;
  let playerNameCompare = escapestring(playerName, false);
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  document.getElementById("popup").style.display = "flex";
  if (playerNameCompare == localPlayer) {
    document.getElementById("popup").innerHTML =
      '<div id="titlepopup">Actions for yourself<div id="close" onclick="closepopup()"></div></div></div>';
    document.getElementById("popup").innerHTML +=
      '<div id="popupelements"></div>';
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="surrender()">Surrender</div>';
    if (enableAssistFunction == true) {
      if (isInAssistQueue == false) {
        document.getElementById("popupelements").innerHTML +=
          '<div id="popupelement"><div id="assistEnemy" onclick="assist()">Assist</div></div>';
      } else {
        document.getElementById("popupelements").innerHTML +=
          '<div id="popupelement"><div id="cancelAssistEnemy" onclick="cancelAssist()">Cancel Assist</div></div>';
      }
    }
    if (localPlayerIsSquadLeader == true) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="localSquad()">Squad</div>';
    } else if (localPlayerSquad != 0) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="leaveSquad()">Leave Squad</div>';
    } else {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="createSquad()">Create Squad</div>';
    }
    if (admin == true || isOwner == true) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="adminpopup(&grave;' +
        playerName +
        '&grave;)">Admin</div>';
    }
  } else {
    document.getElementById("popup").innerHTML =
      '<div id="titlepopup">Actions for the player: ' +
      playerNameInline +
      '<div id="close" onclick="closepopup()"></div></div></div>';
    document.getElementById("popup").innerHTML +=
      '<div id="popupelements"></div>';
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="votekick(&grave;' +
      playerName +
      '&grave;)">Votekick</div>';
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="voteban(&grave;' +
      playerName +
      '&grave;)">Voteban</div>';
    if (playersMuted.includes(playerNameCompare)) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="unmute(&grave;' +
        playerName +
        '&grave;)">Unmute</div>';
    } else {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="mute(&grave;' +
        playerName +
        '&grave;)">Mute</div>';
    }
    if (squadId == localPlayerSquad && localPlayerIsSquadLeader == true) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="squad(&grave;' +
        playerName +
        '&grave;)">Squad</div>';
    } else if (
      squadId != localPlayerSquad &&
      squadId != 0 &&
      squadCount[squadId] < maxSquadSize &&
      isSquadPrivate == false
    ) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="joinSquad(&grave;' +
        playerName +
        '&grave;)">Join Squad</div>';
    }
    if (admin == true || isOwner == true) {
      document.getElementById("popupelements").innerHTML +=
        '<div id="popupelement" onclick="adminpopup(&grave;' +
        playerName +
        '&grave;)">Admin</div>';
    }
  }
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}
/* Region AdminPopup (gets triggered in popup button "Admin")*/
function adminpopup(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Actions for the player: ' +
    playerNameInline +
    '<div id="close" onclick="closepopup()"></div></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  if (canMovePlayers == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="move(&grave;' +
      playerName +
      '&grave;)">Move</div>';
  }
  if (canKillPlayers == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="kill(&grave;' +
      playerName +
      '&grave;)">Kill</div>';
  }
  if (canKickPlayers == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="kick(&grave;' +
      playerName +
      '&grave;)">Kick</div>';
  }
  if (canTemporaryBanPlayers == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="tban(&grave;' +
      playerName +
      '&grave;)">TBan</div>';
  }
  if (canPermanentlyBanPlayers == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="ban(&grave;' +
      playerName +
      '&grave;)">Ban</div>';
  }
  if (canEditGameAdminList == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="getAdminRightsOfPlayer(&grave;' +
      playerName +
      '&grave;)">Edit rights</div>';
  }
  if (canEditGameAdminList == true || isOwner == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="promoteToAdmin(&grave;' +
      playerName +
      '&grave;)">Promote to admin</div>';
  }
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}
/* Endregion */

/* Region Closepopup */
function closepopup() {
  document.getElementById("popup").style.display = "none";
  document.getElementById("popup").innerHTML = "";
}
/* Endregion */

/* Region Popup Response */
function showPopupResponse(message) {
  document.getElementById("popupResponse").style.display = "flex";
  document.getElementById("titlepopupResponse").innerHTML =
    "<span>" + message[0] + "</span>";
  document.getElementById("popupelementResponse").innerHTML = message[1];
  WebUI.Call("EnableMouse");
  if (message[0] == "Assist Queue.") {
    isInAssistQueue = true;
  } else if (message[0] == "Assist Enemy Team.") {
    isInAssistQueue = false;
  }
}

function closePopupResponse() {
  document.getElementById("popupResponse").style.display = null;
  WebUI.Call("ResetMouse");
}
/* Endregion */

/* Region vote stuff */
function votekick(playerName) {
  showHideVotings = true;
  WebUI.Call("DispatchEvent", "WebUI:VotekickPlayer", playerName);
  closepopup();
  document.getElementById("voteyes").style.fontWeight = "900";
}
function voteban(playerName) {
  showHideVotings = true;
  WebUI.Call("DispatchEvent", "WebUI:VotebanPlayer", playerName);
  closepopup();
  document.getElementById("voteyes").style.fontWeight = "900";
}
function startvotekick(args) {
  let playerName = args[0].replace(/\&/g, "&amp;");
  playerName = playerName.replace(/\</g, "&lt;");
  playerName = playerName.replace(/\>/g, "&gt;");
  playerName = playerName.replace(/\"/g, "&quot;");
  playerName = playerName.replace(/\'/g, "&#39;");
  playerName = playerName.replace(/\\/g, "&#92;");
  isVoteInProgress = true;
  secondsLeft = args[1];
  yesvotes = 1;
  novotes = 0;
  if (showHideVotings == true) {
    document.getElementById("votepopup").classList.add("shown"); biaPinVotePopup();
  }
  document.getElementById("votetitleleft").innerHTML =
    "<p>Votekick: " + playerName + "</p>";
  i = 1;
  width = document.getElementById("orangeRect").clientWidth;
  // width is 0 while the popup is still hidden, which made this loop
  // never terminate and hung the client. Guard on both ends.
  while (
    width > 0 &&
    i < playerName.length &&
    document.getElementById("votetitleleft").clientWidth >= width * 0.7
  ) {
    length = playerName.length - i;
    document.getElementById("votetitleleft").innerHTML =
      "<p>Votekick: " + playerName.slice(0, length) + "...</p>";
    i = i + 1;
  }
  document.getElementById("votetitleleft").style.width = "80%";
  document.getElementById("votetitleright").innerHTML =
    "<p>" + secondsLeft + " sec</p>";
  document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
}
function startvoteban(args) {
  let playerName = args[0].replace(/\&/g, "&amp;");
  playerName = playerName.replace(/\</g, "&lt;");
  playerName = playerName.replace(/\>/g, "&gt;");
  playerName = playerName.replace(/\"/g, "&quot;");
  playerName = playerName.replace(/\'/g, "&#39;");
  playerName = playerName.replace(/\\/g, "&#92;");
  isVoteInProgress = true;
  secondsLeft = args[1];
  yesvotes = 1;
  novotes = 0;
  if (showHideVotings == true) {
    document.getElementById("votepopup").classList.add("shown"); biaPinVotePopup();
  }
  document.getElementById("votetitleleft").innerHTML =
    "<p>Voteban: " + playerName + "</p>";
  i = 1;
  while (
    i < playerName.length &&
    document.getElementById("votetitleleft").clientWidth >= 200
  ) {
    length = playerName.length - i;
    document.getElementById("votetitleleft").innerHTML =
      "<p>Voteban: " + playerName.slice(0, length) + "...</p>";
    i = i + 1;
  }
  document.getElementById("votetitleleft").style.width = "80%";
  document.getElementById("votetitleright").innerHTML =
    "<p>" + secondsLeft + " sec</p>";
  document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
}
function startsurrender() {
  isVoteInProgress = true;
  secondsLeft = 30;
  yesvotes = 1;
  novotes = 0;
  if (showHideVotings == true) {
    document.getElementById("votepopup").classList.add("shown"); biaPinVotePopup();
  }
  document.getElementById("votetitleleft").style.width = "80%";
  document.getElementById("votetitleleft").innerHTML = "<p>Surrender</p>";
  document.getElementById("votetitleright").innerHTML =
    "<p>" + secondsLeft + " sec</p>";
  document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
}
function voteYes() {
  yesvotes += 1;
  if (showHideVotings == true) {
    document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  }
}
function voteNo() {
  novotes += 1;
  if (showHideVotings == true) {
    document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
  }
}

function removeOneYesVote() {
  yesvotes -= 1;
  if (showHideVotings == true) {
    document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  }
}

function removeOneNoVote() {
  novotes -= 1;
  if (showHideVotings == true) {
    document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
  }
}
function updateTimer() {
  secondsLeft = secondsLeft - 1;
  if (showHideVotings == true) {
    document.getElementById("votetitleright").innerHTML =
      "<p>" + secondsLeft + " sec</p>";
    if (secondsLeft == 0) {
      isVoteInProgress = false;
      document.getElementById("votepopup").classList.remove("shown");
      document.getElementById("voteyes").style.fontWeight = null;
      document.getElementById("voteno").style.fontWeight = null;
      document.getElementById("votetitleleft").style.width = null;
    }
  }
}
function fontWeightYes() {
  document.getElementById("voteyes").style.fontWeight = "900";
  document.getElementById("voteno").style.fontWeight = null;
}
function fontWeightNo() {
  document.getElementById("voteno").style.fontWeight = "900";
  document.getElementById("voteyes").style.fontWeight = null;
}
function voteInProgress() {
  //pop up that says: You can't start a vote because a vote is already in progress.
}
/* Endregion */

/* Region Player Mute */
function mute(playerName) {
  playersMuted.push(escapestring(playerName, false));
  WebUI.Call("DispatchEvent", "WebUI:MutePlayer", playerName);
  closepopup();
}
function unmute(playerName) {
  let playerNameArg = escapestring(playerName, false);
  if (playersMuted.indexOf(playerNameArg) > -1) {
    playersMuted.splice(playersMuted.indexOf(playerNameArg), 1);
  }
  WebUI.Call("DispatchEvent", "WebUI:UnmutePlayer", playerName);
  closepopup();
}
/* Endregion */

/* Region Local Player Squad Actions */
function localSquad() {
  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Actions for your squad<div id="close" onclick="closepopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="leaveSquad()">Leave Squad</div>';
  if (localPlayerIsSquadPrivate == true) {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="privateSquad()">Open Squad</div>';
    localPlayerIsSquadPrivate = false;
  } else {
    document.getElementById("popupelements").innerHTML +=
      '<div id="popupelement" onclick="privateSquad()">Close Squad</div>';
    localPlayerIsSquadPrivate = true;
  }
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}
function leaveSquad() {
  WebUI.Call("DispatchEvent", "WebUI:LeaveSquad");
  closepopup();
}
function privateSquad() {
  WebUI.Call("DispatchEvent", "WebUI:PrivateSquad");
  closepopup();
}
function createSquad() {
  WebUI.Call("DispatchEvent", "WebUI:CreateSquad");
  closepopup();
}
/* Endregion */

/* Region Squad Action for other players */
function squad(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Squadactions for the player: ' +
    playerNameInline +
    '<div id="close" onclick="closepopup()"></div></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="kickSquad(&grave;' +
    playerName +
    '&grave;)">Kick from Squad</div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="makeSquadLeader(&grave;' +
    playerName +
    '&grave;)">Promote to SQ Leader</div>';
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}
function joinSquad(playerName) {
  WebUI.Call("DispatchEvent", "WebUI:JoinSquad", playerName);
  closepopup();
}
function kickSquad(playerName) {
  WebUI.Call("DispatchEvent", "WebUI:KickFromSquad", playerName);
  closepopup();
}
function makeSquadLeader(playerName) {
  WebUI.Call("DispatchEvent", "WebUI:MakeSquadLeader", playerName);
  closepopup();
}
/* Endregion */

/* Region ServerInfo */
function getServerInfo(args) {
  varsPresetNormal = true;
  varsPresetInfantry = true;
  varsPresetHardcore = true;
  varsPresetHardcoreNoMap = true;

  document.getElementById("serverNameDescrContainerHeader").innerHTML =
    "<p>" + args[0] + "</p>";
  document.getElementById("serverNameDescrContainerBody").innerHTML =
    "<p>" + args[1] + "</p>";
  //document.getElementById("serverMessage").innerHTML = args[2];
  //document.getElementById("gamePassword").innerHTML = args[3];
  if (args[4] == "true") {
    document.getElementById("autobalance").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetAutobalance").innerHTML = "Yes";
  } else if (args[4] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("autobalance").innerHTML = "<p>No</p>";
    document.getElementById("customPresetAutobalance").innerHTML = "No";
  }
  if (args[5] == "true") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("friendlyFire").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetFriendlyFire").innerHTML = "Yes";
  } else if (args[5] == "false") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("friendlyFire").innerHTML = "<p>No</p>";
    document.getElementById("customPresetFriendlyFire").innerHTML = "No";
  }
  if (args[6] == "true") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("killCam").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetKillCam").innerHTML = "Yes";
  } else if (args[6] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("killCam").innerHTML = "<p>No</p>";
    document.getElementById("customPresetKillCam").innerHTML = "No";
  }
  if (args[7] == "true") {
    varsPresetHardcoreNoMap = false;
    document.getElementById("miniMap").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetMiniMap").innerHTML = "Yes";
  } else if (args[7] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    document.getElementById("miniMap").innerHTML = "<p>No</p>";
    document.getElementById("customPresetMiniMap").innerHTML = "No";
  }
  if (args[8] == "true") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("hud").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetHUD").innerHTML = "Yes";
  } else if (args[8] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("hud").innerHTML = "<p>No</p>";
    document.getElementById("customPresetHUD").innerHTML = "No";
  }
  if (args[9] == "true") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("3dSpotting").innerHTML = "<p>Yes</p>";
    document.getElementById("customPreset3dSpotting").innerHTML = "Yes";
  } else if (args[9] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("3dSpotting").innerHTML = "<p>No</p>";
    document.getElementById("customPreset3dSpotting").innerHTML = "No";
  }
  if (args[10] == "true") {
    document.getElementById("minimapSpotting").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetMinimapSpotting").innerHTML = "Yes";
  } else if (args[10] == "false") {
    varsPresetHardcoreNoMap = false;
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    document.getElementById("minimapSpotting").innerHTML = "<p>No</p>";
    document.getElementById("customPresetMinimapSpotting").innerHTML = "No>";
  }
  if (args[11] == "true") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("nameTag").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetNameTag").innerHTML = "Yes";
  } else if (args[11] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("nameTag").innerHTML = "<p>No</p>";
    document.getElementById("customPresetNameTag").innerHTML = "No";
  }
  if (args[12] == "true") {
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("3rdPersonCam").innerHTML = "<p>Yes</p>";
    document.getElementById("customPreset3rdPersonCam").innerHTML = "Yes";
  } else if (args[12] == "false") {
    varsPresetNormal = false;
    document.getElementById("3rdPersonCam").innerHTML = "<p>No</p>";
    document.getElementById("customPreset3rdPersonCam").innerHTML = "No";
  }
  if (args[13] == "true") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("regenerateHealth").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetRegenerateHealth").innerHTML = "Yes";
  } else if (args[13] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("regenerateHealth").innerHTML = "<p>No</p>";
    document.getElementById("customPresetRegenerateHealth").innerHTML = "No";
  }
  if (args[14] == "true") {
    varsPresetInfantry = false;
    document.getElementById("vehicleSpawn").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetVehicleSpawn").innerHTML = "Yes";
  } else if (args[14] == "false") {
    varsPresetNormal = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("vehicleSpawn").innerHTML = "<p>No</p>";
    document.getElementById("customPresetVehicleSpawn").innerHTML = "No";
  }
  if (args[15] == "true") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    document.getElementById("onlySquadLeaderSpawn").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetOnlySquadLeaderSpawn").innerHTML =
      "Yes";
  } else if (args[15] == "false") {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("onlySquadLeaderSpawn").innerHTML = "<p>No</p>";
    document.getElementById("customPresetOnlySquadLeaderSpawn").innerHTML =
      "No";
  }
  /*
	if(args[19] == "true"){
		document.getElementById("highPerfRepl").innerHTML = '<p>Yes</p>';
	}else if(args[19] == "false"){
		document.getElementById("highPerfRepl").innerHTML = '<p>No</p>';
	}*/
  document.getElementById("maxPlayers").innerHTML = args[22];
  document.getElementById("maximumPlayers").innerHTML =
    "<p>" + args[22] + "</p>";
  if (
    args[23] != 5 ||
    args[27] != 3 ||
    args[35] != 100 ||
    args[36] != 100 ||
    args[37] != 100 ||
    args[28] != 300 ||
    args[48] != 100 ||
    args[40] != 100 ||
    args[41] != 1
  ) {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
  }
  if (args[34] != 60) {
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
  } else if (args[34] != 100) {
    varsPresetNormal = false;
    varsPresetInfantry = false;
  }
  document.getElementById("teamKillCountForKick").innerHTML =
    "<p>" + args[23] + "</p>";
  document.getElementById("customPresetTeamKillCountForKick").innerHTML =
    args[23];
  //document.getElementById("teamKillValueForKick").innerHTML = '<p>'+args[24]+'</p>';
  //document.getElementById("teamKillValueIncrease").innerHTML = '<p>'+args[25]+'</p>';
  //document.getElementById("teamKillValueDecrease").innerHTML = '<p>'+args[26]+'</p>';
  document.getElementById("teamKillKicksForBan").innerHTML =
    "<p>" + args[27] + "</p>";
  document.getElementById("customPresetTeamKillKicksForBan").innerHTML =
    args[27];
  document.getElementById("idleTimeout").innerHTML = "<p>" + args[28] + "</p>";
  document.getElementById("customPresetIdleTimeout").innerHTML = args[28];
  //document.getElementById("idleBanRounds").innerHTML = '<p>'+args[29]+'</p>';
  document.getElementById("roundStartPlayerCount").innerHTML =
    "<p>" + args[30] + "</p>";
  //document.getElementById("roundRestartPlayerCount").innerHTML = '<p>'+args[31]+'</p>';
  //document.getElementById("roundLockdownCountdown").innerHTML = '<p>'+args[32]+'</p>';
  //document.getElementById("vehicleSpawnDelay").innerHTML = '<p>'+args[33]+'</p>';
  document.getElementById("soldierHealth").innerHTML =
    "<p>" + args[34] + "</p>";
  document.getElementById("customPresetPlayerHealth").innerHTML = args[34];
  document.getElementById("playerRespawnTime").innerHTML =
    "<p>" + args[35] + "</p>";
  document.getElementById("customPresetPlayerRespawnTime").innerHTML = args[35];
  document.getElementById("playerManDownTime").innerHTML =
    "<p>" + args[36] + "</p>";
  document.getElementById("customPresetPlayerManDownTime").innerHTML = args[36];
  document.getElementById("bulletDamage").innerHTML = "<p>" + args[37] + "</p>";
  document.getElementById("customPresetBulletDamage").innerHTML = args[37];
  document.getElementById("tickets").innerHTML = "<p>" + args[38] + "</p>";
  if (args[39] == "0") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>Normal</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Normal";
  } else if (args[39] != "0") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
  }
  if (args[39] == "1") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>Normal Reversed</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Normal Reversed";
  } else if (args[39] == "2") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>Light Weight</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Light Weight";
  } else if (args[39] == "3") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>Heavy Gear</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Heavy Gear";
  } else if (args[39] == "4") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>Pistols Only</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Pistols Only";
  } else if (args[39] == "5") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>Snipers Heaven</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Snipers Heaven";
  } else if (args[39] == "6") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>US Arms Race</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "US Arms Race";
  } else if (args[39] == "7") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>RU Arms Race</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "<p>RU Arms Race";
  } else if (args[39] == "8") {
    document.getElementById("gunmasterWeaponsPreset").innerHTML =
      "<p>EU Arms Race</p>";
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "EU Arms Race";
  }
  //document.getElementById("serverBannerURL").innerHTML = '<p>'+args[43]+'</p>';
  biaBuildMapLists(args[44], args[45][0], args[45][1]);
  document.getElementById("rounds").innerHTML = "<p>" + args[46][1] + "</p>";
  document.getElementById("region").innerHTML = args[47];
  document.getElementById("ctfRoundTimeModifier").innerHTML =
    "<p>" + args[48] + "</p>";
  document.getElementById("customPresetCtfRoundTimeModifier").innerHTML =
    args[48];
  if (args[21] == "true") {
    document.getElementById("colorCorrectionEnabled").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetBluetint").innerHTML = "Yes";
  } else if (args[21] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("colorCorrectionEnabled").innerHTML = "<p>No</p>";
    document.getElementById("customPresetBluetint").innerHTML = "No";
  }
  if (args[20] == "true") {
    document.getElementById("sunFlare").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetSunFlare").innerHTML = "Yes";
  } else if (args[20] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("sunFlare").innerHTML = "<p>No</p>";
    document.getElementById("customPresetSunFlare").innerHTML = "No";
  }
  document.getElementById("suppressionMultiplier").innerHTML =
    "<p>" + args[40] + "</p>";
  document.getElementById("customPresetSuppressionMultiplier").innerHTML =
    args[40];
  let timeScaling = args[41] * 100;
  document.getElementById("timeScale").innerHTML = "<p>" + timeScaling + "</p>";
  document.getElementById("customPresetTimeScale").innerHTML = timeScaling;
  if (args[17] == "true") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("desertingAllowed").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetAllowDeserting").innerHTML = "Yes";
  } else if (args[17] == "false") {
    document.getElementById("desertingAllowed").innerHTML = "<p>No</p>";
    document.getElementById("customPresetAllowDeserting").innerHTML = "No";
  }
  if (args[16] == "true") {
    document.getElementById("destructionEnabled").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetDestructionEnabled").innerHTML = "Yes";
  } else if (args[16] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("destructionEnabled").innerHTML = "<p>No</p>";
    document.getElementById("customPresetDestructionEnabled").innerHTML = "No";
  }
  if (args[18] == "true") {
    document.getElementById("vehicleDisablingEnabled").innerHTML = "<p>Yes</p>";
    document.getElementById("customPresetVehicleDisabling").innerHTML = "Yes";
  } else if (args[18] == "false") {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
    document.getElementById("vehicleDisablingEnabled").innerHTML = "<p>No</p>";
    document.getElementById("customPresetVehicleDisabling").innerHTML = "No";
  }
  if (args[49] == "regular") {
    document.getElementById("frequencyMode").innerHTML = "<p>30 Hz</p>";
  } else if (args[49] == "high60") {
    document.getElementById("frequencyMode").innerHTML = "<p>60 Hz</p>";
  } else if (args[49] == "high120") {
    document.getElementById("frequencyMode").innerHTML = "<p>120 Hz</p>";
  }
  document.getElementById("squadSize").innerHTML = "<p>" + args[42] + "</p>";
  maxSquadSize = args[42];
  document.getElementById("customPresetSquadSize").innerHTML = args[42];
  if (args[42] != 4) {
    varsPresetNormal = false;
    varsPresetInfantry = false;
    varsPresetHardcore = false;
    varsPresetHardcoreNoMap = false;
  }
  document.getElementById("modListConfiguration").innerHTML = "";
  for (let i = 0; i < args[50].length; i++) {
    document.getElementById("modListConfiguration").innerHTML +=
      '<div id="serverInfoConfigurationElement"><p>' +
      args[50][i] +
      "</p></div>";
    let k = i + 1;
    document.getElementById("serverInfoPlayersTopBody").innerHTML =
      "Active: " + k;
  }
  if (varsPresetNormal == true) {
    document.getElementById("serverInfoPresetConfigurationBody").innerHTML =
      "Normal";
    document.getElementById("serverInfoPresetBody").innerHTML = "Normal";
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Normal";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Normal";
    document.getElementById("presetNormal").style.display = "flex";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (varsPresetInfantry == true) {
    document.getElementById("serverInfoPresetConfigurationBody").innerHTML =
      "Infantry";
    document.getElementById("serverInfoPresetBody").innerHTML = "Infantry";
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Infantry";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Infantry";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "flex";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (varsPresetHardcore == true) {
    document.getElementById("serverInfoPresetConfigurationBody").innerHTML =
      "Hardcore";
    document.getElementById("serverInfoPresetBody").innerHTML = "Hardcore";
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Hardcore";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Hardcore";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "flex";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (varsPresetHardcoreNoMap == true) {
    document.getElementById("serverInfoPresetConfigurationBody").innerHTML =
      "Hardcore No Map";
    document.getElementById("serverInfoPresetBody").innerHTML =
      "Hardcore No Map";
    document.getElementById("serverSetupCurrentPreset").innerHTML =
      "Hardcore No Map";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Hardcore No Map";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "flex";
    document.getElementById("presetCustom").style.display = "none";
  } else {
    document.getElementById("serverInfoPresetConfigurationBody").innerHTML =
      "Custom";
    document.getElementById("serverInfoPresetBody").innerHTML = "Custom";
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Custom";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Custom";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "flex";
  }
  document.getElementById("serverInfoOwnerBody").innerHTML = args[51];
}
function generateModeUrl(mode) {
  if (
    mode == "ConquestLarge0" ||
    mode == "ConquestSmall0" ||
    mode == "ConquestAssaultLarge0" ||
    mode == "ConquestAssaultSmall0" ||
    mode == "ConquestAssaultSmall1"
  ) {
    return "UI/Art/GameMode/gm_cq";
  } else if (mode == "RushLarge0") {
    return "UI/Art/GameMode/gm_Rush";
  } else if (mode == "SquadRush0") {
    return "UI/Art/GameMode/gm_sqRush";
  } else if (mode == "SquadDeathMatch0") {
    return "UI/Art/GameMode/gm_sdm";
  } else if (mode == "TeamDeathMatch0") {
    return "UI/Art/GameMode/gm_tdm";
  } else if (mode == "TeamDeathMatchC0") {
    return "UI/Art/GameMode/gm_tdmcq";
  } else if (mode == "Domination0") {
    return "UI/Art/GameMode/gm_dom";
  } else if (mode == "GunMaster0") {
    return "UI/Art/GameMode/gm_gm";
  } else if (mode == "TankSuperiority0") {
    return "UI/Art/GameMode/gm_ts";
  } else if (mode == "Scavenger0") {
    return "UI/Art/GameMode/gm_scv";
  } else if (mode == "CaptureTheFlag0") {
    return "UI/Art/GameMode/gm_ctf";
  } else if (mode == "AirSuperiority0") {
    return "UI/Art/GameMode/gm_as";
  } else {
    return "UI/Art/GameMode/gm_cq";
  }
}
function generateMapUrl(map) {
  if (map == "MP_001") {
    return "UI/Art/Menu/LevelThumbs/MP01_thumb";
  } else if (map == "MP_003") {
    return "UI/Art/Menu/LevelThumbs/MP03_thumb";
  } else if (map == "MP_007") {
    return "UI/Art/Menu/LevelThumbs/MP07_thumb";
  } else if (map == "MP_011") {
    return "UI/Art/Menu/LevelThumbs/MP11_thumb";
  } else if (map == "MP_012") {
    return "UI/Art/Menu/LevelThumbs/MP12_thumb";
  } else if (map == "MP_013") {
    return "UI/Art/Menu/LevelThumbs/MP13_thumb";
  } else if (map == "MP_017") {
    return "UI/Art/Menu/LevelThumbs/MP17_thumb";
  } else if (map == "MP_018") {
    return "UI/Art/Menu/LevelThumbs/MP18_thumb";
  } else if (map == "MP_Subway") {
    return "UI/Art/Menu/LevelThumbs/MP15_thumb";
  } else if (map == "XP1_001") {
    return "UI/Art/Menu/LevelThumbs/XP01_thumb";
  } else if (map == "XP1_002") {
    return "UI/Art/Menu/LevelThumbs/XP02_thumb";
  } else if (map == "XP1_003") {
    return "UI/Art/Menu/LevelThumbs/XP03_thumb";
  } else if (map == "XP1_004") {
    return "UI/Art/Menu/LevelThumbs/XP04_thumb";
  } else if (map == "XP2_Factory") {
    return "UI/Art/Menu/LevelThumbs/Xp2_Factory_thumb";
  } else if (map == "XP2_Office") {
    return "UI/Art/Menu/LevelThumbs/Xp2_Office_thumb";
  } else if (map == "XP2_Palace") {
    return "UI/Art/Menu/LevelThumbs/Xp2_Palace_thumb";
  } else if (map == "XP2_Skybar") {
    return "UI/Art/Menu/LevelThumbs/Xp2_Skybar_thumb";
  } else if (map == "XP3_Desert") {
    return "UI/Art/Menu/LevelThumbs/Xp3_Desert_thumb";
  } else if (map == "XP3_Alborz") {
    return "UI/Art/Menu/LevelThumbs/Xp3_Alborz_thumb";
  } else if (map == "XP3_Shield") {
    return "UI/Art/Menu/LevelThumbs/Xp3_Shield_thumb";
  } else if (map == "XP3_Valley") {
    return "UI/Art/Menu/LevelThumbs/Xp3_Valley_thumb";
  } else if (map == "XP4_Quake") {
    return "UI/Art/Menu/LevelThumbs/XP4_Quake_thumb";
  } else if (map == "XP4_FD") {
    return "UI/Art/Menu/LevelThumbs/XP4_FD_thumb";
  } else if (map == "XP4_Parl") {
    return "UI/Art/Menu/LevelThumbs/XP4_Parl_thumb";
  } else if (map == "XP4_Rubble") {
    return "UI/Art/Menu/LevelThumbs/XP4_Rubble_thumb";
  } else if (map == "XP5_001") {
    return "UI/Art/Menu/LevelThumbs/Xp5_001_thumb";
  } else if (map == "XP5_002") {
    return "UI/Art/Menu/LevelThumbs/Xp5_002_thumb";
  } else if (map == "XP5_003") {
    return "UI/Art/Menu/LevelThumbs/Xp5_003_thumb";
  } else if (map == "XP5_004") {
    return "UI/Art/Menu/LevelThumbs/Xp5_004_thumb";
  } else {
    return "UI/Art/Menu/LevelThumbs/empty_thumb";
  }
}

function generateMapName(map) {
  if (map == "MP_001") {
    return "Grand Bazaar";
  } else if (map == "MP_003") {
    return "Teheran Highway";
  } else if (map == "MP_007") {
    return "Caspian Border";
  } else if (map == "MP_011") {
    return "Seine Crossing";
  } else if (map == "MP_012") {
    return "Operation Firestorm";
  } else if (map == "MP_013") {
    return "Damavand Peak";
  } else if (map == "MP_017") {
    return "Noshahr Canals";
  } else if (map == "MP_018") {
    return "Kharg Island";
  } else if (map == "MP_Subway") {
    return "Operation Métro";
  } else if (map == "XP1_001") {
    return "Strike at Karkand";
  } else if (map == "XP1_002") {
    return "Gulf of Oman";
  } else if (map == "XP1_003") {
    return "Sharqi Peninsula";
  } else if (map == "XP1_004") {
    return "Wake Island";
  } else if (map == "XP2_Factory") {
    return "Scrapmetal";
  } else if (map == "XP2_Office") {
    return "Operation 925";
  } else if (map == "XP2_Palace") {
    return "Donya Fortress";
  } else if (map == "XP2_Skybar") {
    return "Ziba Tower";
  } else if (map == "XP3_Desert") {
    return "Bandar Desert";
  } else if (map == "XP3_Alborz") {
    return "Alborz Mountains";
  } else if (map == "XP3_Shield") {
    return "Armored Shield";
  } else if (map == "XP3_Valley") {
    return "Death Valley";
  } else if (map == "XP4_Quake") {
    return "Epicenter";
  } else if (map == "XP4_FD") {
    return "Markaz Monolith";
  } else if (map == "XP4_Parl") {
    return "Azadi Palace";
  } else if (map == "XP4_Rubble") {
    return "Talah Market";
  } else if (map == "XP5_001") {
    return "Operation Riverside";
  } else if (map == "XP5_002") {
    return "Nebandan Flats";
  } else if (map == "XP5_003") {
    return "Kiasar Railroad";
  } else if (map == "XP5_004") {
    return "Sabalan Pipeline";
  } else if (map == "COOP_007") {
    return "Operation Exodus";
  } else if (map == "COOP_006") {
    return "Fire from the Sky";
  } else if (map == "COOP_009") {
    return "Exfiltration";
  } else if (map == "COOP_002") {
    return "Hit and Run";
  } else if (map == "COOP_003") {
    return "Drop 'Em Like Liquid";
  } else if (map == "COOP_010") {
    return "The Eleventh Hour";
  } else if (map == "SP_New_York") {
    return "Semper Fidelis";
  } else if (map == "SP_Earthquake") {
    return "Operation Swordbreaker";
  } else if (map == "SP_Earthquake_2") {
    return "Uprising";
  } else if (map == "SP_Jet") {
    return "Going Hunting";
  } else if (map == "SP_Bank") {
    return "Operation Guillotine";
  } else if (map == "SP_Paris") {
    return "Comrades";
  } else if (map == "SP_Tank") {
    return "Thunder Run";
  } else if (map == "SP_Tank_B") {
    return "Fear No Evil";
  } else if (map == "SP_Sniper") {
    return "Night Shift";
  } else if (map == "SP_Valley") {
    return "Rock and a Hard Place";
  } else if (map == "SP_Villa") {
    return "Kaffarov";
  } else if (map == "SP_Finale") {
    return "The Great Destroyer";
  } else {
    return map;
  }
}

function generateModeName(mode) {
  if (mode == "ConquestLarge0") {
    return "Conquest 64";
  } else if (mode == "ConquestSmall0") {
    return "Conquest";
  } else if (mode == "ConquestAssaultLarge0") {
    return "Conquest Assault 64";
  } else if (mode == "ConquestAssaultSmall0") {
    return "Conquest Assault";
  } else if (mode == "ConquestAssaultSmall1") {
    return "Conquest Assault: Day 2";
  } else if (mode == "RushLarge0") {
    return "Rush";
  } else if (mode == "SquadRush0") {
    return "Squad Rush";
  } else if (mode == "SquadDeathMatch0") {
    return "Squad Deathmatch";
  } else if (mode == "TeamDeathMatch0") {
    return "Team Deathmatch";
  } else if (mode == "TeamDeathMatchC0") {
    return "TDM Close Quarters";
  } else if (mode == "Domination0") {
    return "Conquest Domination";
  } else if (mode == "GunMaster0") {
    return "Gun Master";
  } else if (mode == "TankSuperiority0") {
    return "Tank Superiority";
  } else if (mode == "Scavenger0") {
    return "Scavenger";
  } else if (mode == "CaptureTheFlag0") {
    return "Capture the Flag";
  } else if (mode == "AirSuperiority0") {
    return "Air Superiority";
  } else {
    return mode;
  }
}

function showMapRotation() {
  document.getElementById("serverInfoConfiguration").style.display = "none";
  document.getElementById("mapListConfiguration").style.display = "flex";
  document.getElementById("modListConfiguration").style.display = "none";
  document.getElementById("serverInfoMapRotationBody").style.color = "#000";
  document.getElementById("serverInfoMapRotationBody").style.fontWeight = "900";
  document.getElementById("serverInfoMapRotationBody").style.background =
    "linear-gradient(#ffffff, #909090d1)";
  document.getElementById("serverInfoPresetConfigurationBody").style.color =
    null;
  document.getElementById(
    "serverInfoPresetConfigurationBody"
  ).style.fontWeight = null;
  document.getElementById(
    "serverInfoPresetConfigurationBody"
  ).style.background = null;
  document.getElementById("serverInfoPlayersTopBody").style.color = null;
  document.getElementById("serverInfoPlayersTopBody").style.background = null;
  document.getElementById("serverInfoPlayersTopBody").style.fontWeight = null;
  document.getElementById("currentMap").src =
    "fb://UI/Art/Menu/Icons/map_current";
  document.getElementById("nextMap").src = "fb://UI/Art/Menu/Icons/map_next";
}
function showServerInfoConfiguration() {
  document.getElementById("serverInfoConfiguration").style.display = "flex";
  document.getElementById("mapListConfiguration").style.display = "none";
  document.getElementById("modListConfiguration").style.display = "none";
  document.getElementById("serverInfoPresetConfigurationBody").style.color =
    "#000";
  document.getElementById(
    "serverInfoPresetConfigurationBody"
  ).style.background = "linear-gradient(#ffffff, #909090d1)";
  document.getElementById(
    "serverInfoPresetConfigurationBody"
  ).style.fontWeight = "900";
  document.getElementById("serverInfoMapRotationBody").style.color = null;
  document.getElementById("serverInfoMapRotationBody").style.background = null;
  document.getElementById("serverInfoMapRotationBody").style.fontWeight = null;
  document.getElementById("serverInfoPlayersTopBody").style.color = null;
  document.getElementById("serverInfoPlayersTopBody").style.background = null;
  document.getElementById("serverInfoPlayersTopBody").style.fontWeight = null;
}
function showModList() {
  document.getElementById("serverInfoConfiguration").style.display = "none";
  document.getElementById("mapListConfiguration").style.display = "none";
  document.getElementById("modListConfiguration").style.display = "flex";
  document.getElementById("serverInfoPresetConfigurationBody").style.color =
    null;
  document.getElementById(
    "serverInfoPresetConfigurationBody"
  ).style.fontWeight = null;
  document.getElementById(
    "serverInfoPresetConfigurationBody"
  ).style.background = null;
  document.getElementById("serverInfoMapRotationBody").style.color = null;
  document.getElementById("serverInfoMapRotationBody").style.fontWeight = null;
  document.getElementById("serverInfoMapRotationBody").style.background = null;
  document.getElementById("serverInfoPlayersTopBody").style.color = "#000";
  document.getElementById("serverInfoPlayersTopBody").style.background =
    "linear-gradient(#ffffff, #909090d1)";
  document.getElementById("serverInfoPlayersTopBody").style.fontWeight = "900";
}
/* Endregion */

/* Region Client Settings */
function showOrHidePing() {
  if (document.getElementById("showPing").innerHTML == "Yes") {
    document.getElementById("showPing").innerHTML = "No";
  } else {
    document.getElementById("showPing").innerHTML = "Yes";
  }
}
function showOrHideVotings() {
  if (document.getElementById("hideVotings").innerHTML == "No") {
    document.getElementById("hideVotings").innerHTML = "Yes";
  } else {
    document.getElementById("hideVotings").innerHTML = "No";
  }
}
function toggleMinimapSize(text) {
  if (text != null) {
    document.getElementById("defaultMinimapSize").innerHTML = text;
  } else {
    if (document.getElementById("defaultMinimapSize").innerHTML == "Small") {
      document.getElementById("defaultMinimapSize").innerHTML = "Large";
    } else {
      document.getElementById("defaultMinimapSize").innerHTML = "Small";
    }
  }
}
function toggleHoldScoreboard() {
  if (document.getElementById("scoreboardMethod").innerHTML == "Click Tab") {
    document.getElementById("scoreboardMethod").innerHTML = "Hold Tab";
  } else {
    document.getElementById("scoreboardMethod").innerHTML = "Click Tab";
  }
}

function getMouseSensitivity(mouseSensitivity) {
  document.getElementById("actualMouseSensitivity").value = Number(
    mouseSensitivity.toFixed(7)
  );
  /* keyboard is taken when a field is clicked (biaKb) */
}

function getMouseSensitivityMultipliers(args) {
  document.getElementById("ironSightsMultiplier").value = Number(
    args[0].toFixed(4)
  );
  document.getElementById("holoMultiplier").value = Number(args[1].toFixed(4));
  document.getElementById("3xMultiplier").value = Number(args[2].toFixed(4));
  document.getElementById("4xMultiplier").value = Number(args[3].toFixed(4));
  document.getElementById("6xMultiplier").value = Number(args[4].toFixed(4));
  document.getElementById("7xMultiplier").value = Number(args[5].toFixed(4));
  document.getElementById("8xMultiplier").value = Number(args[6].toFixed(4));
  document.getElementById("10xMultiplier").value = Number(args[7].toFixed(4));
  document.getElementById("12xMultiplier").value = Number(args[8].toFixed(4));
  document.getElementById("20xMultiplier").value = Number(args[9].toFixed(4));
  /* keyboard is taken when a field is clicked (biaKb) */
}

function resetMouseSensitivityMultipliers() {
  WebUI.Call("DispatchEvent", "WebUI:ResetMouseSensitivityMultipliers");
}

function saveMouseSensitivityMultipliers() {
  biaKbRelease();
  const args = [];
  args.push(document.getElementById("ironSightsMultiplier").value);
  args.push(document.getElementById("holoMultiplier").value);
  args.push(document.getElementById("3xMultiplier").value);
  args.push(document.getElementById("4xMultiplier").value);
  args.push(document.getElementById("6xMultiplier").value);
  args.push(document.getElementById("7xMultiplier").value);
  args.push(document.getElementById("8xMultiplier").value);
  args.push(document.getElementById("10xMultiplier").value);
  args.push(document.getElementById("12xMultiplier").value);
  args.push(document.getElementById("20xMultiplier").value);
  WebUI.Call(
    "DispatchEvent",
    "WebUI:SetMouseSensitivityMultipliers",
    JSON.stringify(args)
  );
  var sensBase = document.getElementById("actualMouseSensitivity").value;
  WebUI.Call("DispatchEvent", "WebUI:SetMouseSensitivity", sensBase);
  biaSaveLookLocal({ sens: args, sensBase: sensBase });
  closeSmart();
}

function getFieldOfView(args) {
  document.getElementById("actualFov").value = Number(args[0].toFixed(4));
  document.getElementById("ironSightsFov").value = Number(args[1].toFixed(4));
  document.getElementById("holoFov").value = Number(args[2].toFixed(4));
  document.getElementById("3xFov").value = Number(args[3].toFixed(4));
  document.getElementById("4xFov").value = Number(args[4].toFixed(4));
  document.getElementById("6xFov").value = Number(args[5].toFixed(4));
  document.getElementById("7xFov").value = Number(args[6].toFixed(4));
  document.getElementById("8xFov").value = Number(args[7].toFixed(4));
  document.getElementById("10xFov").value = Number(args[8].toFixed(4));
  document.getElementById("12xFov").value = Number(args[9].toFixed(4));
  document.getElementById("20xFov").value = Number(args[10].toFixed(4));
  /* keyboard is taken when a field is clicked (biaKb) */
}

function resetFieldOfView() {
  WebUI.Call("DispatchEvent", "WebUI:ResetFieldOfView");
}

function saveFieldOfView() {
  biaKbRelease();
  const args = [];
  if (document.getElementById("actualFov").value > 160) {
    args.push(160);
  } else if (document.getElementById("actualFov").value < 60) {
    args.push(60);
  } else {
    args.push(document.getElementById("actualFov").value);
  }
  if (document.getElementById("ironSightsFov").value > 160) {
    args.push(160);
  } else if (document.getElementById("ironSightsFov").value < 51.774) {
    args.push(51.774);
  } else {
    args.push(document.getElementById("ironSightsFov").value);
  }
  if (document.getElementById("holoFov").value > 51.774) {
    args.push(51.774);
  } else if (document.getElementById("holoFov").value < 41.846) {
    args.push(41.846);
  } else {
    args.push(document.getElementById("holoFov").value);
  }
  if (document.getElementById("3xFov").value > 41.846) {
    args.push(41.846);
  } else if (document.getElementById("3xFov").value < 26.46) {
    args.push(26.46);
  } else {
    args.push(document.getElementById("3xFov").value);
  }
  if (document.getElementById("4xFov").value > 26.46) {
    args.push(26.46);
  } else if (document.getElementById("4xFov").value < 22.801) {
    args.push(22.801);
  } else {
    args.push(document.getElementById("4xFov").value);
  }
  if (document.getElementById("6xFov").value > 22.801) {
    args.push(22.801);
  } else if (document.getElementById("6xFov").value < 15.425) {
    args.push(15.425);
  } else {
    args.push(document.getElementById("6xFov").value);
  }
  if (document.getElementById("7xFov").value > 15.425) {
    args.push(15.425);
  } else if (document.getElementById("7xFov").value < 13.174) {
    args.push(13.174);
  } else {
    args.push(document.getElementById("7xFov").value);
  }
  if (document.getElementById("8xFov").value > 13.174) {
    args.push(13.174);
  } else if (document.getElementById("8xFov").value < 11.582) {
    args.push(11.582);
  } else {
    args.push(document.getElementById("8xFov").value);
  }
  if (document.getElementById("10xFov").value > 11.582) {
    args.push(11.582);
  } else if (document.getElementById("10xFov").value < 9.324) {
    args.push(9.324);
  } else {
    args.push(document.getElementById("10xFov").value);
  }
  if (document.getElementById("12xFov").value > 9.324) {
    args.push(9.324);
  } else if (document.getElementById("12xFov").value < 7.728) {
    args.push(7.728);
  } else {
    args.push(document.getElementById("12xFov").value);
  }
  if (document.getElementById("20xFov").value > 7.728) {
    args.push(7.728);
  } else if (document.getElementById("20xFov").value < 4.665) {
    args.push(4.665);
  } else {
    args.push(document.getElementById("20xFov").value);
  }
  WebUI.Call("DispatchEvent", "WebUI:SetFieldOfView", JSON.stringify(args));
  biaSaveLookLocal({ fov: args });
  closeSmart();
}
/* Endregion */

/* Region another close action for whatever reason */
function keyboardResetAndClosepopup() {
  biaKbRelease();
  closepopup();
}
/* Endregion */

/* Region Surrender (move to vote stuff)*/
function surrender() {
  showHideVotings = true;
  WebUI.Call("DispatchEvent", "WebUI:Surrender");
  closepopup();
  document.getElementById("voteyes").style.fontWeight = "900";
}
/* Endregion */

/* Region admin actions for player */
function move(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  biaKbPopupOpen();
  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Moving: ' +
    playerNameInline +
    '<div id="close" onclick="keyboardResetAndClosepopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div class="dropdown"><input onclick="teamDropdownOpen()" id="teamIdInput" type="text" name="1" value="Team US"></input><div class="dropDownButton" onclick="teamDropdownOpen()"></div><div id="teamNamesDropDown" class="dropdown-content"><p onclick="teamDropdownClose(&grave;1&grave;, &grave;Team US&grave;)">Team US</p><p onclick="teamDropdownClose(&grave;2&grave;, &grave;Team RU&grave;)">Team RU</p></div></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div class="dropdown"><input onclick="squadDropdownOpen()" id="squadIdInput" type="text" name="0" value="No Squad"></input><div class="dropDownButton" onclick="squadDropdownOpen()"></div><div id="squadNamesDropDown" class="dropdown-content"><p onclick="squadDropdownClose(&grave;0&grave;, &grave;No Squad&grave;)">No Squad</p><p onclick="squadDropdownClose(&grave;1&grave;, &grave;Squad Alpha&grave;)">Squad Alpha</p><p onclick="squadDropdownClose(&grave;2&grave;, &grave;Squad Bravo&grave;)">Squad Bravo</p><p onclick="squadDropdownClose(&grave;3&grave;, &grave;Squad Charlie&grave;)">Squad Charlie</p><p onclick="squadDropdownClose(&grave;4&grave;, &grave;Squad Delta&grave;)">Squad Delta</p><p onclick="squadDropdownClose(&grave;5&grave;, &grave;Squad Echo&grave;)">Squad Echo</p><p onclick="squadDropdownClose(&grave;6&grave;, &grave;Squad Foxtrot&grave;)">Squad Foxtrot</p><p onclick="squadDropdownClose(&grave;7&grave;, &grave;Squad Golf&grave;)">Squad Golf</p><p onclick="squadDropdownClose(&grave;8&grave;, &grave;Squad Hotel&grave;)">Squad Hotel</p><p onclick="squadDropdownClose(&grave;9&grave;, &grave;Squad India&grave;)">Squad India</p><p onclick="squadDropdownClose(&grave;10&grave;, &grave;Squad Juliet&grave;)">Squad Juliet</p><p onclick="squadDropdownClose(&grave;11&grave;, &grave;Squad Kilo&grave;)">Squad Kilo</p><p onclick="squadDropdownClose(&grave;12&grave;, &grave;Squad Lima&grave;)">Squad Lima</p><p onclick="squadDropdownClose(&grave;13&grave;, &grave;Squad Mike&grave;)">Squad Mike</p><p onclick="squadDropdownClose(&grave;14&grave;, &grave;Squad November&grave;)">Squad November</p><p onclick="squadDropdownClose(&grave;15&grave;, &grave;Squad Oscar&grave;)">Squad Oscar</p><p onclick="squadDropdownClose(&grave;16&grave;, &grave;Squad Papa&grave;)">Squad Papa</p><p onclick="squadDropdownClose(&grave;17&grave;, &grave;Squad Quebec&grave;)">Squad Quebec</p><p onclick="squadDropdownClose(&grave;18&grave;, &grave;Squad Romeo&grave;)">Squad Romeo</p><p onclick="squadDropdownClose(&grave;19&grave;, &grave;Squad Sierra&grave;)">Squad Sierra</p><p onclick="squadDropdownClose(&grave;20&grave;, &grave;Squad Tango&grave;)">Squad Tango</p><p onclick="squadDropdownClose(&grave;21&grave;, &grave;Squad Uniform&grave;)">Squad Uniform</p><p onclick="squadDropdownClose(&grave;22&grave;, &grave;Squad Victor&grave;)">Squad Victor</p><p onclick="squadDropdownClose(&grave;23&grave;, &grave;Squad Whiskey&grave;)">Squad Whiskey</p><p onclick="squadDropdownClose(&grave;24&grave;, &grave;Squad Xray&grave;)">Squad Xray</p><p onclick="squadDropdownClose(&grave;25&grave;, &grave;Squad Yankee&grave;)">Squad Yankee</p><p onclick="squadDropdownClose(&grave;26&grave;, &grave;Squad Zulu&grave;)">Squad Zulu</p><p onclick="squadDropdownClose(&grave;27&grave;, &grave;Squad Haggard&grave;)">Squad Haggard</p><p onclick="squadDropdownClose(&grave;28&grave;, &grave;Squad Sweetwater&grave;)">Squad Sweetwater</p><p onclick="squadDropdownClose(&grave;29&grave;, &grave;Squad Preston&grave;)">Squad Preston</p><p onclick="squadDropdownClose(&grave;30&grave;, &grave;Squad Redford&grave;)">Squad Redford</p><p onclick="squadDropdownClose(&grave;31&grave;, &grave;Squad Faith&grave;)">Squad Faith</p><p onclick="squadDropdownClose(&grave;32&grave;, &grave;Squad Celeste&grave;)">Squad Celeste</p></div></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div><input id="moveReason" type="text" placeholder="Reason: (Optional)"></input></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="moveNow(&grave;' +
    playerName +
    '&grave;)">Move</div>';
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}
function teamDropdownOpen() {
  document.getElementById("teamNamesDropDown").style.display = "flex";
}
function teamDropdownClose(teamId, teamName) {
  teamIdToSwitch = teamId;
  teamNameToSwitch = teamName;
  document.getElementById("teamIdInput").name = teamId;
  document.getElementById("teamIdInput").value = teamName;
  document.getElementById("teamNamesDropDown").style.display = "none";
}
function squadDropdownOpen() {
  document.getElementById("squadNamesDropDown").style.display = "flex";
}
function squadDropdownClose(squadId, squadName) {
  squadIdToSwitch = squadId;
  squadNameToSwitch = squadName;
  document.getElementById("squadIdInput").name = squadId;
  document.getElementById("squadIdInput").value = squadName;
  document.getElementById("squadNamesDropDown").style.display = "none";
}
function moveNow(playerName) {
  biaKbRelease();
  const moveArgs = [
    playerName,
    teamIdToSwitch,
    squadIdToSwitch,
    document.getElementById("moveReason").value,
  ];
  WebUI.Call("DispatchEvent", "WebUI:MovePlayer", JSON.stringify(moveArgs));
  closepopup();
  teamIdToSwitch = "1";
  teamNameToSwitch = "Team US";
  squadIdToSwitch = "0";
  squadNameToSwitch = "No Squad";
}
function kill(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  biaKbPopupOpen();
  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Killing: ' +
    playerNameInline +
    '<div id="close" onclick="keyboardResetAndClosepopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div><input id="killReason" type="text" placeholder="Reason: (Optional)"></input></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="killNow(&grave;' +
    playerName +
    '&grave;)">Kill</div>';
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}

function killNow(playerName) {
  biaKbRelease();
  const killArgs = [playerName, document.getElementById("killReason").value];
  WebUI.Call("DispatchEvent", "WebUI:KillPlayer", JSON.stringify(killArgs));
  closepopup();
}
function kick(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  biaKbPopupOpen();
  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Kicking: ' +
    playerNameInline +
    '<div id="close" onclick="keyboardResetAndClosepopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div><input id="kickReason" type="text" placeholder="Reason: (Optional)"></input></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="kickNow(&grave;' +
    playerName +
    '&grave;)">Kick</div>';
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}

function kickNow(playerName) {
  biaKbRelease();
  const kickArgs = [playerName, document.getElementById("kickReason").value];
  WebUI.Call("DispatchEvent", "WebUI:KickPlayer", JSON.stringify(kickArgs));
  closepopup();
}

function tban(playerName) {
  if (biaIsBot(playerName)) {
    biaRefuseBot(playerName);
    return;
  }
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  biaKbPopupOpen();
  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Temp. Ban: ' +
    playerNameInline +
    '<div id="close" onclick="keyboardResetAndClosepopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div><input id="tbanDuration" type="text" placeholder="Time: (in minutes)"></input></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div><input id="tbanReason" type="text" placeholder="Reason: (Optional)"></input></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="tbanNow(&grave;' +
    playerName +
    '&grave;)">TBan</div>';
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}

function tbanNow(playerName) {
  biaKbRelease();
  const tbanArgs = [
    playerName,
    document.getElementById("tbanDuration").value,
    document.getElementById("tbanReason").value,
  ];
  WebUI.Call("DispatchEvent", "WebUI:TBanPlayer", JSON.stringify(tbanArgs));
  closepopup();
}
function ban(playerName) {
  if (biaIsBot(playerName)) {
    biaRefuseBot(playerName);
    return;
  }
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  biaKbPopupOpen();
  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Banning: ' +
    playerNameInline +
    '<div id="close" onclick="keyboardResetAndClosepopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div><input id="banReason" type="text" placeholder="Reason: (Optional)"></input></div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="banNow(&grave;' +
    playerName +
    '&grave;)">Ban</div>';
  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}

function banNow(playerName) {
  biaKbRelease();
  const banArgs = [playerName, document.getElementById("banReason").value];
  WebUI.Call("DispatchEvent", "WebUI:BanPlayer", JSON.stringify(banArgs));
  closepopup();
}
function getAdminRightsOfPlayer(playerName) {
  adminrights(playerName);
  WebUI.Call("DispatchEvent", "WebUI:GetAdminRightsOfPlayer", playerName);
}
function getAdminRightsOfPlayerDone(abilities) {
  if (abilities == null) {
    playerCanMovePlayers = false;
    playerCanKillPlayers = false;
    playerCanKickPlayers = false;
    playerCanTemporaryBanPlayers = false;
    playerCanPermanentlyBanPlayers = false;
    playerCanEditGameAdminList = false;
    playerCanEditBanList = false;
    playerCanEditMapList = false;
    playerCanUseMapFunctions = false;
    playerCanAlterServerSettings = false;
    playerCanEditReservedSlotsList = false;
    playerCanEditTextChatModerationList = false;
    playerCanShutdownServer = false;
  } else {
    if (abilities.canMovePlayers == true) {
      playerCanMovePlayers = true;
    } else {
      playerCanMovePlayers = false;
    }
    if (abilities.canKillPlayers == true) {
      playerCanKillPlayers = true;
    } else {
      playerCanKillPlayers = false;
    }
    if (abilities.canKickPlayers == true) {
      playerCanKickPlayers = true;
    } else {
      playerCanKickPlayers = false;
    }
    if (abilities.canTemporaryBanPlayers == true) {
      playerCanTemporaryBanPlayers = true;
    } else {
      playerCanTemporaryBanPlayers = false;
    }
    if (abilities.canPermanentlyBanPlayers == true) {
      playerCanPermanentlyBanPlayers = true;
    } else {
      playerCanPermanentlyBanPlayers = false;
    }
    if (abilities.canEditGameAdminList == true) {
      playerCanEditGameAdminList = true;
    } else {
      playerCanEditGameAdminList = false;
    }
    if (abilities.canEditBanList == true) {
      playerCanEditBanList = true;
    } else {
      playerCanEditBanList = false;
    }
    if (abilities.canEditMapList == true) {
      playerCanEditMapList = true;
    } else {
      playerCanEditMapList = false;
    }
    if (abilities.canUseMapFunctions == true) {
      playerCanUseMapFunctions = true;
    } else {
      playerCanUseMapFunctions = false;
    }
    if (abilities.canAlterServerSettings == true) {
      playerCanAlterServerSettings = true;
    } else {
      playerCanAlterServerSettings = false;
    }
    if (abilities.canEditReservedSlotsList == true) {
      playerCanEditReservedSlotsList = true;
    } else {
      playerCanEditReservedSlotsList = false;
    }
    if (abilities.canEditTextChatModerationList == true) {
      playerCanEditTextChatModerationList = true;
    } else {
      playerCanEditTextChatModerationList = false;
    }
    if (abilities.canShutdownServer == true) {
      playerCanShutdownServer = true;
    } else {
      playerCanShutdownServer = false;
    }
  }
  if (playerCanMovePlayers == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canMovePlayers" id="pCanMove" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Move</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canMovePlayers" id="pCanMove" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Move</div></div>';
  }
  if (playerCanKillPlayers == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canKillPlayers" id="pCanKill" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Kill</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canKillPlayers" id="pCanKill" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Kill</div></div>';
  }
  if (playerCanKickPlayers == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canKickPlayers" id="pCanKick" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Kick</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canKickPlayers" id="pCanKick" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Kick</div></div>';
  }
  if (playerCanTemporaryBanPlayers == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canTemporaryBanPlayers" id="pCanTban" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Tban</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canTemporaryBanPlayers" id="pCanTban" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Tban</div></div>';
  }
  if (playerCanPermanentlyBanPlayers == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canPermanentlyBanPlayers" id="pCanBan" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Ban</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canPermanentlyBanPlayers" id="pCanBan" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Ban</div></div>';
  }
  if (playerCanEditGameAdminList == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canEditGameAdminList" id="pCanEdit" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Rights</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canEditGameAdminList" id="pCanEdit" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Rights</div></div>';
  }
  if (playerCanEditBanList == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canEditBanList" id="pCanEditBanList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Ban List</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canEditBanList" id="pCanEditBanList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Ban List</div></div>';
  }
  if (playerCanEditMapList == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canEditMapList" id="pCanEditMapList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Map List</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canEditMapList" id="pCanEditMapList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Map List</div></div>';
  }
  if (playerCanUseMapFunctions == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canUseMapFunctions" id="pCanUseMapFunctions" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Use Map Functions</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canUseMapFunctions" id="pCanUseMapFunctions" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Use Map Functions</div></div>';
  }
  if (playerCanAlterServerSettings == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canAlterServerSettings" id="pCanAlterServerSettings" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Alter Server Settings</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canAlterServerSettings" id="pCanAlterServerSettings" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Alter Server Settings</div></div>';
  }
  if (playerCanEditReservedSlotsList == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canEditReservedSlotsList" id="pCanEditReservedSlotsList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Reserved Slot List</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canEditReservedSlotsList" id="pCanEditReservedSlotsList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Reserved Slot List</div></div>';
  }
  if (playerCanEditTextChatModerationList == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canEditTextChatModerationList" id="pCanEditTextChatModerationList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Text Chat Moderation List</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canEditTextChatModerationList" id="pCanEditTextChatModerationList" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Edit Text Chat Moderation List</div></div>';
  }
  if (playerCanShutdownServer == false) {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck" data-name="editRightsInput" data-value="canShutdownServer" id="pCanShutdownServer" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Shutdown Server</div></div>';
  } else {
    document.getElementById("checkBoxSwitches").innerHTML +=
      '<div class="biaCheck checked" data-name="editRightsInput" data-value="canShutdownServer" id="pCanShutdownServer" onclick="toggleBiaCheck(this)"><div class="biaCheckTrack"><div class="biaCheckKnob"></div></div><div class="biaCheckLabel">Can Shutdown Server</div></div>';
  }

  if (
    document.getElementById("popupelements").offsetHeight >
    document.getElementById("popup").offsetHeight
  ) {
    document.getElementById("popupelements").style.height = "100%";
  }
}

function adminrights(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  document.getElementById("popup").innerHTML =
    '<div id="titlepopup">Edit Admin Rights: ' +
    playerNameInline +
    '<div id="close" onclick="closeEditAdminpopup()"></div></div>';
  document.getElementById("popup").innerHTML +=
    '<div id="popupelements"><div id="checkBoxSwitches"></div></div>';

  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="deleteAdminRights(&grave;' +
    playerName +
    '&grave;)">Delete</div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="deleteAndSaveAdminRights(&grave;' +
    playerName +
    '&grave;)">Delete & Save</div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="applyAdminRights(&grave;' +
    playerName +
    '&grave;)">Apply</div>';
  document.getElementById("popupelements").innerHTML +=
    '<div id="popupelement" onclick="saveAdminRights(&grave;' +
    playerName +
    '&grave;)">Save</div>';
}

function deleteAdminRights(playerName) {
  const args = [playerName];
  WebUI.Call("DispatchEvent", "WebUI:DeleteAdminRights", JSON.stringify(args));
  if (typeof biaAdminList !== "undefined" && Array.isArray(biaAdminList)) {
    biaAdminList = biaAdminList.filter(function (a) {
      var n = typeof a === "string" ? a : a && (a.name || a[0]);
      return n !== playerName;
    });
    if (typeof biaRenderList === "function") biaRenderList();
  }
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetAdminList"); }, 400);
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetAdminList"); }, 1600);
  closeEditAdminpopup();
}

function deleteAndSaveAdminRights(playerName) {
  const args = [playerName];
  WebUI.Call(
    "DispatchEvent",
    "WebUI:DeleteAndSaveAdminRights",
    JSON.stringify(args)
  );
  if (typeof biaAdminList !== "undefined" && Array.isArray(biaAdminList)) {
    biaAdminList = biaAdminList.filter(function (a) {
      var n = typeof a === "string" ? a : a && (a.name || a[0]);
      return n !== playerName;
    });
    if (typeof biaRenderList === "function") biaRenderList();
  }
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetAdminList"); }, 400);
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetAdminList"); }, 1600);
  closeEditAdminpopup();
}

function applyAdminRights(playerName) {
  const checkboxes = document.querySelectorAll('.biaCheck[data-name="editRightsInput"]');
  const num = checkboxes.length;
  const args = [playerName];
  for (let i = 0; i < num; i++) {
    if (checkboxes[i].classList.contains("checked")) {
      args.push("true");
    } else {
      args.push("false");
    }
  }
  WebUI.Call("DispatchEvent", "WebUI:UpdateAdminRights", JSON.stringify(args));
  closeEditAdminpopup();
}

function saveAdminRights(playerName) {
  const checkboxes = document.querySelectorAll('.biaCheck[data-name="editRightsInput"]');
  const num = checkboxes.length;
  const args = [playerName];
  for (let i = 0; i < num; i++) {
    if (checkboxes[i].classList.contains("checked")) {
      args.push("true");
    } else {
      args.push("false");
    }
  }
  WebUI.Call(
    "DispatchEvent",
    "WebUI:UpdateAndSaveAdminRights",
    JSON.stringify(args)
  );
  closeEditAdminpopup();
}

function closeEditAdminpopup() {
  playerCanMovePlayers = false;
  playerCanKillPlayers = false;
  playerCanKickPlayers = false;
  playerCanTemporaryBanPlayers = false;
  playerCanPermanentlyBanPlayers = false;
  playerCanEditGameAdminList = false;
  playerCanEditBanList = false;
  playerCanEditMapList = false;
  playerCanUseMapFunctions = false;
  playerCanAlterServerSettings = false;
  playerCanEditReservedSlotsList = false;
  playerCanEditTextChatModerationList = false;
  playerCanShutdownServer = false;
  closepopup();
}

function setOwnerRights() {
  isOwner = true;
  biaRefreshAdminUi();
}
// for the local Player:
function biaTruthy(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}
function getAdminRights(abilities) {
  if (abilities == null) {
    admin = false;
    canMovePlayers = false;
    canKillPlayers = false;
    canKickPlayers = false;
    canTemporaryBanPlayers = false;
    canPermanentlyBanPlayers = false;
    canEditGameAdminList = false;
    canEditBanList = false;
    canEditMapList = false;
    canUseMapFunctions = false;
    canAlterServerSettings = false;
    canEditReservedSlotsList = false;
    canEditTextChatModerationList = false;
    canShutdownServer = false;
    biaRefreshAdminUi();
    return;
  }
  admin = true;
  canMovePlayers = biaTruthy(abilities.canMovePlayers);
  canKillPlayers = biaTruthy(abilities.canKillPlayers);
  canKickPlayers = biaTruthy(abilities.canKickPlayers);
  canTemporaryBanPlayers = biaTruthy(abilities.canTemporaryBanPlayers);
  canPermanentlyBanPlayers = biaTruthy(abilities.canPermanentlyBanPlayers);
  canEditGameAdminList = biaTruthy(abilities.canEditGameAdminList);
  canEditBanList = biaTruthy(abilities.canEditBanList);
  canEditMapList = biaTruthy(abilities.canEditMapList);
  canUseMapFunctions = biaTruthy(abilities.canUseMapFunctions);
  canAlterServerSettings = biaTruthy(abilities.canAlterServerSettings);
  canEditReservedSlotsList = biaTruthy(abilities.canEditReservedSlotsList);
  canEditTextChatModerationList = biaTruthy(abilities.canEditTextChatModerationList);
  canShutdownServer = biaTruthy(abilities.canShutdownServer);
  biaRefreshAdminUi();
}
function biaIsMapAdmin() {
  return isOwner === true || canUseMapFunctions === true || canEditMapList === true;
}
function biaRefreshAdminUi() {
  biaEnforceTabs();
  biaEnsureQueuePanel();
  biaRenderQueue();
  // Vote/Insta buttons depend on rights: rebuild locally from the cached list,
  // then ask the server for a fresh copy (throttled).
  biaRebuildMapListsFromCache();
  biaRequestMapRotation(false);
}
/* Endregion */

/* Region Assist */
function assist() {
  WebUI.Call("DispatchEvent", "WebUI:AssistEnemyTeam");
  closepopup();
}
function cancelAssist() {
  WebUI.Call("DispatchEvent", "WebUI:CancelAssistEnemyTeam");
  isInAssistQueue = false;
  closepopup();
}
/* Endregion */

/* Region Scoreboard */
function updateScoreboardHeader(scoreboardHeader) {
  // squad mode is re-enabled by updateScoreboardHeader2 in the same update
  if (biaSquadMode) biaSquadLayoutOff();
  squadCount.length = 0;
  place1 = 0;
  place2 = 0;
  biaSbReset(1, scoreboardHeader[0], scoreboardHeader[1]);
  biaSbReset(2, scoreboardHeader[2], scoreboardHeader[3]);
  localPlayer = scoreboardHeader[4].replace(/\&/g, "&amp;");
  localPlayer = localPlayer.replace(/\</g, "&lt;");
  localPlayer = localPlayer.replace(/\>/g, "&gt;");
  localPlayer = localPlayer.replace(/\"/g, "&quot;");
  localPlayer = localPlayer.replace(/\'/g, "&#39;");
  localPlayer = localPlayer.replace(/\\/g, "&#92;");
  localPlayerSquad = scoreboardHeader[5];
  localPlayerIsSquadLeader = scoreboardHeader[6];
  localPlayerIsSquadPrivate = scoreboardHeader[7];
}

function updateScoreboardHeader2(scoreboardHeader) {
  biaSquadMode = true;
  place3 = 0;
  place4 = 0;
  biaById("table3").style.display = "flex";
  biaById("table4").style.display = "flex";
  biaSbReset(3, scoreboardHeader[0], scoreboardHeader[1]);
  biaSbReset(4, scoreboardHeader[2], scoreboardHeader[3]);
}

function updateScoreboardBody1(sendThis1) {
  let playerNameArg = escapestring(sendThis1[1], true);
  sendThis1[1] = escapestring(sendThis1[1], false);

  if (squadCount[sendThis1[5]] == null) {
    squadCount[sendThis1[5]] = 1;
  } else {
    squadCount[sendThis1[5]] += 1;
  }
  place1 += 1;
  if (localPlayer == sendThis1[1]) {
    localPing = sendThis1[8];
    document.getElementById("showLocalPing").innerHTML =
      "<p>Ping: <span>" + localPing + " ms</span></p>";
    if (sendThis1[6] == true) {
      biaSbAppend("table1tbody", '<div onmousedown="action(&grave;' +
        playerNameArg +
        "&grave;, " +
        sendThis1[5] +
        ", " +
        sendThis1[9] +
        ')" id="localPlayerScoreboard" class="sbRow ' +
        sendThis1[7] +
        '"><div class="sbCell" id="place1">' +
        place1 +
        '</div><div class="sbCell" id="name1">' +
        sendThis1[1] +
        '</div><div class="sbCell" id="kills1">' +
        sendThis1[2] +
        '</div><div class="sbCell" id="deaths1">' +
        sendThis1[3] +
        '</div><div class="sbCell" id="points1">' +
        sendThis1[4] +
        '</div><div class="sbCell" id="ping1">' +
        sendThis1[8] +
        "</div></div>");
    } else {
      biaSbAppend("table1tbody", '<div onmousedown="action(&grave;' +
        playerNameArg +
        "&grave;, " +
        sendThis1[5] +
        ", " +
        sendThis1[9] +
        ')" id="localPlayerScoreboard" class="sbRow ' +
        sendThis1[7] +
        ' isDead"><div class="sbCell" id="place1">' +
        place1 +
        '</div><div class="sbCell" id="name1">' +
        sendThis1[1] +
        '</div><div class="sbCell" id="kills1">' +
        sendThis1[2] +
        '</div><div class="sbCell" id="deaths1">' +
        sendThis1[3] +
        '</div><div class="sbCell" id="points1">' +
        sendThis1[4] +
        '</div><div class="sbCell" id="ping1">' +
        sendThis1[8] +
        "</div></div>");
    }
  } else if (localPlayerSquad == sendThis1[5] && localPlayerSquad != 0) {
    if (sendThis1[6] == true) {
      biaSbAppend("table1tbody", '<div onmousedown="action(&grave;' +
        playerNameArg +
        "&grave;, " +
        sendThis1[5] +
        ", " +
        sendThis1[9] +
        ')" id="squadMates" class="sbRow ' +
        sendThis1[7] +
        '"><div class="sbCell" id="place1">' +
        place1 +
        '</div><div class="sbCell" id="name1">' +
        sendThis1[1] +
        '</div><div class="sbCell" id="kills1">' +
        sendThis1[2] +
        '</div><div class="sbCell" id="deaths1">' +
        sendThis1[3] +
        '</div><div class="sbCell" id="points1">' +
        sendThis1[4] +
        '</div><div class="sbCell" id="ping1">' +
        sendThis1[8] +
        "</div></div>");
    } else {
      biaSbAppend("table1tbody", '<div onmousedown="action(&grave;' +
        playerNameArg +
        "&grave;, " +
        sendThis1[5] +
        ", " +
        sendThis1[9] +
        ')" id="squadMates" class="sbRow ' +
        sendThis1[7] +
        ' isDead"><div class="sbCell" id="place1">' +
        place1 +
        '</div><div class="sbCell" id="name1">' +
        sendThis1[1] +
        '</div><div class="sbCell" id="kills1">' +
        sendThis1[2] +
        '</div><div class="sbCell" id="deaths1">' +
        sendThis1[3] +
        '</div><div class="sbCell" id="points1">' +
        sendThis1[4] +
        '</div><div class="sbCell" id="ping1">' +
        sendThis1[8] +
        "</div></div>");
    }
  } else {
    if (sendThis1[6] == true) {
      biaSbAppend("table1tbody", '<div onmousedown="action(&grave;' +
        playerNameArg +
        "&grave;, " +
        sendThis1[5] +
        ", " +
        sendThis1[9] +
        ')" class="sbRow squad' +
        sendThis1[5] +
        " " +
        sendThis1[7] +
        '" onmouseover="showWholeSquad(&grave;squad' +
        sendThis1[5] +
        '&grave;)" onmouseout="hideWholeSquad(&grave;squad' +
        sendThis1[5] +
        '&grave;)"><div class="sbCell" id="place1">' +
        place1 +
        '</div><div class="sbCell" id="name1">' +
        sendThis1[1] +
        '</div><div class="sbCell" id="kills1">' +
        sendThis1[2] +
        '</div><div class="sbCell" id="deaths1">' +
        sendThis1[3] +
        '</div><div class="sbCell" id="points1">' +
        sendThis1[4] +
        '</div><div class="sbCell" id="ping1">' +
        sendThis1[8] +
        "</div></div>");
    } else {
      biaSbAppend("table1tbody", '<div onmousedown="action(&grave;' +
        playerNameArg +
        "&grave;, " +
        sendThis1[5] +
        ", " +
        sendThis1[9] +
        ')" class="sbRow squad' +
        sendThis1[5] +
        " " +
        sendThis1[7] +
        ' isDead" onmouseover="showWholeSquad(&grave;squad' +
        sendThis1[5] +
        '&grave;)" onmouseout="hideWholeSquad(&grave;squad' +
        sendThis1[5] +
        '&grave;)"><div class="sbCell" id="place1">' +
        place1 +
        '</div><div class="sbCell" id="name1">' +
        sendThis1[1] +
        '</div><div class="sbCell" id="kills1">' +
        sendThis1[2] +
        '</div><div class="sbCell" id="deaths1">' +
        sendThis1[3] +
        '</div><div class="sbCell" id="points1">' +
        sendThis1[4] +
        '</div><div class="sbCell" id="ping1">' +
        sendThis1[8] +
        "</div></div>");
    }
  }
}
function updateScoreboardBody2(sendThis2) {
  let playerNameArg = escapestring(sendThis2[1], true);
  sendThis2[1] = escapestring(sendThis2[1], false);

  place2 += 1;
  // sendThis2[5] = Alive status, sendThis2[7] = Kit Class string (e.g., 'ID_M_ASSAULT')
  if (sendThis2[5] == true) {
    biaSbAppend("table2tbody", '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ", " +
      true +
      ')" class="sbRow esquad' +
      sendThis2[8] +
      " " +
      sendThis2[7] +
      '" onmouseover="showWholeSquad(&grave;esquad' +
      sendThis2[8] +
      '&grave;)" onmouseout="hideWholeSquad(&grave;esquad' +
      sendThis2[8] +
      '&grave;)"><div class="sbCell" id="place2">' +
      place2 +
      '</div><div class="sbCell" id="name2">' +
      sendThis2[1] +
      '</div><div class="sbCell" id="kills2">' +
      sendThis2[2] +
      '</div><div class="sbCell" id="deaths2">' +
      sendThis2[3] +
      '</div><div class="sbCell" id="points2">' +
      sendThis2[4] +
      '</div><div class="sbCell" id="ping2">' +
      sendThis2[6] +
      "</div></div>");
  } else {
    biaSbAppend("table2tbody", '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ", " +
      true +
      ')" class="sbRow esquad' +
      sendThis2[8] +
      " " +
      sendThis2[7] +
      ' isDead" onmouseover="showWholeSquad(&grave;esquad' +
      sendThis2[8] +
      '&grave;)" onmouseout="hideWholeSquad(&grave;esquad' +
      sendThis2[8] +
      '&grave;)"><div class="sbCell" id="place2">' +
      place2 +
      '</div><div class="sbCell" id="name2">' +
      sendThis2[1] +
      '</div><div class="sbCell" id="kills2">' +
      sendThis2[2] +
      '</div><div class="sbCell" id="deaths2">' +
      sendThis2[3] +
      '</div><div class="sbCell" id="points2">' +
      sendThis2[4] +
      '</div><div class="sbCell" id="ping2">' +
      sendThis2[6] +
      "</div></div>");
  }
}
function updateScoreboardBody3(size) {
  biaSbFlush();
  size = parseInt(size, 10) || 0;
  var t1b = biaById("table1tbody");
  var t2b = biaById("table2tbody");
  // squad deathmatch: top squads show 6 rows (rest scrolls), no long padding
  if (biaSquadMode) size = BIA_SQUAD_TOP_ROWS;
  if (t1b && size > place1) {
    t1b.innerHTML += biaSbEmptyRows(1, size - place1);
    place1 = size;
  }
  if (t2b && size > place2) {
    t2b.innerHTML += biaSbEmptyRows(2, size - place2);
    place2 = size;
  }
  var sb = biaById("scoreboard");
  var tables = biaById("tables");
  if (sb) {
    sb.style.display = "flex";
    sb.style.visibility = "visible";
    sb.style.opacity = "1";
  }
  if (tables) {
    tables.style.display = "flex";
    tables.style.visibility = "visible";
  }
  var t1 = biaById("table1");
  var t2 = biaById("table2");
  if (t1) {
    t1.style.height = null;
    t1.style.display = "flex";
  }
  if (t2) {
    t2.style.height = null;
    t2.style.display = "flex";
  }
  biaSbAfterRender(false);
  setTimeout(function () {
    biaSbAfterRender(true);
  }, 30);
}
function updateScoreboardBody4(sendThis3) {
  let playerNameArg = escapestring(sendThis3[1], true);
  sendThis3[1] = escapestring(sendThis3[1], false);

  place3 += 1;
  if (sendThis3[5] == true) {
    biaSbAppend("table3tbody", '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')" class="sbRow"><div class="sbCell" id="place3">' +
      place3 +
      '</div><div class="sbCell" id="name3">' +
      sendThis3[1] +
      '</div><div class="sbCell" id="kills3">' +
      sendThis3[2] +
      '</div><div class="sbCell" id="deaths3">' +
      sendThis3[3] +
      '</div><div class="sbCell" id="points3">' +
      sendThis3[4] +
      '</div><div class="sbCell" id="ping3">' +
      sendThis3[6] +
      "</div></div>");
  } else {
    biaSbAppend("table3tbody", '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')" class="sbRow isDead"><div class="sbCell" id="place3">' +
      place3 +
      '</div><div class="sbCell" id="name3">' +
      sendThis3[1] +
      '</div><div class="sbCell" id="kills3">' +
      sendThis3[2] +
      '</div><div class="sbCell" id="deaths3">' +
      sendThis3[3] +
      '</div><div class="sbCell" id="points3">' +
      sendThis3[4] +
      '</div><div class="sbCell" id="ping3">' +
      sendThis3[6] +
      "</div></div>");
  }
}
function updateScoreboardBody5(sendThis4) {
  let playerNameArg = escapestring(sendThis4[1], true);
  sendThis4[1] = escapestring(sendThis4[1], false);

  place4 += 1;
  if (sendThis4[5] == true) {
    biaSbAppend("table4tbody", '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')" class="sbRow"><div class="sbCell" id="place4">' +
      place4 +
      '</div><div class="sbCell" id="name4">' +
      sendThis4[1] +
      '</div><div class="sbCell" id="kills4">' +
      sendThis4[2] +
      '</div><div class="sbCell" id="deaths4">' +
      sendThis4[3] +
      '</div><div class="sbCell" id="points4">' +
      sendThis4[4] +
      '</div><div class="sbCell" id="ping4">' +
      sendThis4[6] +
      "</div></div>");
  } else {
    biaSbAppend("table4tbody", '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')" class="sbRow isDead"><div class="sbCell" id="place4">' +
      place4 +
      '</div><div class="sbCell" id="name4">' +
      sendThis4[1] +
      '</div><div class="sbCell" id="kills4">' +
      sendThis4[2] +
      '</div><div class="sbCell" id="deaths4">' +
      sendThis4[3] +
      '</div><div class="sbCell" id="points4">' +
      sendThis4[4] +
      '</div><div class="sbCell" id="ping4">' +
      sendThis4[6] +
      "</div></div>");
  }
}
function updateScoreboardBody6() {
  biaSbFlush();
  var t3b = biaById("table3tbody");
  var t4b = biaById("table4tbody");
  if (t3b && place3 < BIA_SQUAD_BOTTOM_ROWS) {
    t3b.innerHTML += biaSbEmptyRows(3, BIA_SQUAD_BOTTOM_ROWS - place3);
    place3 = BIA_SQUAD_BOTTOM_ROWS;
  }
  if (t4b && place4 < BIA_SQUAD_BOTTOM_ROWS) {
    t4b.innerHTML += biaSbEmptyRows(4, BIA_SQUAD_BOTTOM_ROWS - place4);
    place4 = BIA_SQUAD_BOTTOM_ROWS;
  }
  biaById("table3").style.display = "flex";
  biaById("table4").style.display = "flex";
  biaSbAfterRender(false);
  setTimeout(function () {
    biaSbAfterRender(true);
  }, 30);
}
function clearScoreboardBody() {
  biaHideZoomBar();
  document.getElementById("mapRotationTab").style.display = null;
  document.getElementById("mapRotationSettings").style.display = null;
  /* serverSetupTab visibility owned by biaRefreshAdminUi */
  document.getElementById("serverSetupSettings").style.display = null;
  document.getElementById("settingsTab").style.display = null;
  closepopup();
  WebUI.Call("ResetMouse");
  biaKbRelease();
  document.getElementById("scoreboard").style.display = "none";
  var ht = document.getElementById("headertabs");
  if (ht) ht.style.display = "none";
  biaHideZoomBar();
  showServerInfoConfiguration();
  showGeneralClientSettings();
  document.getElementById("tables").style.display = "none";
  document.getElementById("table1").style.display = "none";
  document.getElementById("table2").style.display = "none";
  document.getElementById("table3").style.display = "none";
  document.getElementById("table4").style.display = "none";
  document.getElementById("headertabs").style.display = "none";
  document.getElementById("overlay").style.backgroundColor = null;
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  if (document.getElementById("serverInfoTab").classList.contains("active")) {
    document.getElementById("serverInfoTab").classList.remove("active");
  }
  if (document.getElementById("settingsTab").classList.contains("active")) {
    document.getElementById("settingsTab").classList.remove("active");
  }
  if (
    document.getElementById("scoreboardTab").classList.contains("active") ==
    false
  ) {
    document.getElementById("scoreboardTab").classList.add("active");
  }
  place1 = 0;
  place2 = 0;
  place3 = 0;
  place4 = 0;
  biaSbSavedScroll = {};
  biaSbBuf = {};
  biaSbReset(1, "RU", "50");
  biaSbReset(2, "US", "50");
}


function showWholeSquad(squad) {
  if (squad != "squad0" && squad != "esquad0") {
    Array.prototype.forEach.call(
      document.getElementsByClassName(squad),
      function (element) {
        element.style.background =
          "linear-gradient(#327795, rgba(50, 119, 149, 0.63))";
      }
    );
  }
}
function hideWholeSquad(squad) {
  Array.prototype.forEach.call(
    document.getElementsByClassName(squad),
    function (element) {
      element.style.background = null;
    }
  );
}
/* Endregion */

/* Region RightClick on Scoreboard */
function closeSmart() {
  WebUI.Call("DispatchEvent", "WebUI:ActiveFalse");
  clearScoreboardBody();
}
function showTabsAndEnableMouse() {
  WebUI.Call("EnableMouse");
  var ht = biaById("headertabs");
  // Scoreboard.lua calls this on EVERY left click while the menu is open.
  // Rebuilding the admin UI + zoom each time was wasted work and could steal
  // focus from a field being clicked. Only do the full setup when opening.
  if (ht && ht.style.display === "flex") {
    return;
  }
  biaEnsureUiTree();
  biaEnsureZoomBar();
  biaApplyUiZoom(biaUiZoom, true);
  if (ht) ht.style.display = "flex";
  biaById("overlay").style.backgroundColor = "rgba(11, 35, 51, 0.28)";
  biaRefreshAdminUi();
}
/* Endregion */

/* Region Click on Topbar */
/* Show/ Hide ServerInfo, Scoreboard, Settings, (Map Rotation, Server Setup) */
function showServerInfo() {
  biaSetActiveTab("serverInfoTab");
  document.getElementById("mapRotationSettings").style.display = "none";
  document.getElementById("serverSetupSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  biaKbRelease();
  WebUI.Call("DispatchEvent", "WebUI:GetPlayerCount");
  if (document.getElementById("scoreboardTab").classList.contains("active")) {
    document.getElementById("scoreboardTab").classList.remove("active");
  }
  if (document.getElementById("settingsTab").classList.contains("active")) {
    document.getElementById("settingsTab").classList.remove("active");
  }
  if (
    document.getElementById("serverInfoTab").classList.contains("active") ==
    false
  ) {
    document.getElementById("serverInfoTab").classList.add("active");
  }
  document.getElementById("serverInfo").style.display = "flex";
  document.getElementById("tables").style.display = "none";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("mapRotationSettings").style.display = null;
  document.getElementById("serverSetupSettings").style.display = null;
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  document.getElementById("serverInfoPlayerPingBody").innerHTML =
    localPing + " ms";
  width = document.getElementById("serverInfoMapRotationBody").clientWidth;
  if (document.getElementById("checkModeName").clientWidth >= width - 28) {
    if (
      document
        .getElementById("serverInfoMapRotationBody")
        .classList.contains("slide-left") == false
    ) {
      document
        .getElementById("serverInfoMapRotationBody")
        .classList.add("slide-left");
      document.getElementById("checkModeName").style.width = "inherit";
    }
  } else {
    if (
      document
        .getElementById("serverInfoMapRotationBody")
        .classList.contains("slide-left") == true
    ) {
      document
        .getElementById("serverInfoMapRotationBody")
        .classList.remove("slide-left");
    }
  }
  if (document.getElementById("mapRotationTab").classList.contains("active")) {
    document.getElementById("mapRotationTab").classList.remove("active");
  }
  if (document.getElementById("serverSetupTab").classList.contains("active")) {
    document.getElementById("serverSetupTab").classList.remove("active");
  }
  showServerInfoConfiguration();
}

function getPlayerCount(count) {
  document.getElementById("playerCount").innerHTML = count[0];
  document.getElementById("spectatorCount").innerHTML = count[1];
}

function showScoreboard() {
  biaSetActiveTab("scoreboardTab");
  document.getElementById("mapRotationSettings").style.display = "none";
  document.getElementById("serverSetupSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  biaKbRelease();
  if (document.getElementById("serverInfoTab").classList.contains("active")) {
    document.getElementById("serverInfoTab").classList.remove("active");
  }
  if (document.getElementById("settingsTab").classList.contains("active")) {
    document.getElementById("settingsTab").classList.remove("active");
  }
  if (
    document.getElementById("scoreboardTab").classList.contains("active") ==
    false
  ) {
    document.getElementById("scoreboardTab").classList.add("active");
  }
  if (document.getElementById("mapRotationTab").classList.contains("active")) {
    document.getElementById("mapRotationTab").classList.remove("active");
  }
  if (document.getElementById("serverSetupTab").classList.contains("active")) {
    document.getElementById("serverSetupTab").classList.remove("active");
  }
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("tables").style.display = "flex";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("mapRotationSettings").style.display = null;
  document.getElementById("serverSetupSettings").style.display = null;
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
}
function showClientSettings() {
  biaSetActiveTab("settingsTab");
  document.getElementById("mapRotationSettings").style.display = "none";
  document.getElementById("serverSetupSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  if (document.getElementById("serverInfoTab").classList.contains("active")) {
    document.getElementById("serverInfoTab").classList.remove("active");
  }
  if (
    document.getElementById("settingsTab").classList.contains("active") == false
  ) {
    document.getElementById("settingsTab").classList.add("active");
  }
  if (document.getElementById("scoreboardTab").classList.contains("active")) {
    document.getElementById("scoreboardTab").classList.remove("active");
  }
  if (document.getElementById("mapRotationTab").classList.contains("active")) {
    document.getElementById("mapRotationTab").classList.remove("active");
  }
  if (document.getElementById("serverSetupTab").classList.contains("active")) {
    document.getElementById("serverSetupTab").classList.remove("active");
  }
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("tables").style.display = "none";
  document.getElementById("clientSettings").style.display = "flex";
  document.getElementById("mapRotationSettings").style.display = null;
  document.getElementById("settingsTab").style.display = null;
  /* tab visibility is owned by biaEnforceTabs() */
  document.getElementById("serverSetupSettings").style.display = null;
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  showGeneralClientSettings();
}
/* Endregion */

/* Region Client Settings */
function showGeneralClientSettings() {
  biaShowLookHint(false);
  biaKbRelease();
  if (
    document
      .getElementById("generalClientSettingsTab")
      .classList.contains("active") == false
  ) {
    document.getElementById("generalClientSettingsTab").classList.add("active");
  }
  if (
    document
      .getElementById("mouseSensitivtyClientSettingsTab")
      .classList.contains("active")
  ) {
    document
      .getElementById("mouseSensitivtyClientSettingsTab")
      .classList.remove("active");
  }
  if (
    document.getElementById("fovClientSettingsTab").classList.contains("active")
  ) {
    document.getElementById("fovClientSettingsTab").classList.remove("active");
  }
  if (
    canAlterServerSettings == true ||
    canEditMapList == true ||
    isOwner == true
  ) {
    document.getElementById("serverSetup").style.display = "flex";
  } else {
    document.getElementById("serverSetup").style.display = null;
  }
  if (canUseMapFunctions == true || isOwner == true) {
    document.getElementById("mapRotationSetup").style.display = "flex";
  } else {
    document.getElementById("mapRotationSetup").style.display = null;
  }
  document.getElementById("generalClientSettings").style.display = "flex";
  document.getElementById("mouseSensitivtyClientSettings").style.display =
    "none";
  document.getElementById("fovClientSettings").style.display = "none";
}

function showMouseSensitivtyClientSettings() {
  biaShowLookHint(true);
  biaEnsureLookLocalApplied();
  WebUI.Call("DispatchEvent", "WebUI:GetMouseSensitivity");
  WebUI.Call("DispatchEvent", "WebUI:GetMouseSensitivityMultipliers");
  /* keyboard is taken when a field is clicked (biaKb) */
  if (
    document
      .getElementById("generalClientSettingsTab")
      .classList.contains("active")
  ) {
    document
      .getElementById("generalClientSettingsTab")
      .classList.remove("active");
  }
  if (
    document
      .getElementById("mouseSensitivtyClientSettingsTab")
      .classList.contains("active") == false
  ) {
    document
      .getElementById("mouseSensitivtyClientSettingsTab")
      .classList.add("active");
  }
  if (
    document.getElementById("fovClientSettingsTab").classList.contains("active")
  ) {
    document.getElementById("fovClientSettingsTab").classList.remove("active");
  }
  document.getElementById("generalClientSettings").style.display = "none";
  document.getElementById("mouseSensitivtyClientSettings").style.display =
    "block";
  document.getElementById("fovClientSettings").style.display = "none";
}
function showFovClientSettings() {
  biaShowLookHint(true);
  biaEnsureLookLocalApplied();
  WebUI.Call("DispatchEvent", "WebUI:GetFieldOfView");
  /* keyboard is taken when a field is clicked (biaKb) */
  if (
    document
      .getElementById("generalClientSettingsTab")
      .classList.contains("active")
  ) {
    document
      .getElementById("generalClientSettingsTab")
      .classList.remove("active");
  }
  if (
    document
      .getElementById("mouseSensitivtyClientSettingsTab")
      .classList.contains("active")
  ) {
    document
      .getElementById("mouseSensitivtyClientSettingsTab")
      .classList.remove("active");
  }
  if (
    document
      .getElementById("fovClientSettingsTab")
      .classList.contains("active") == false
  ) {
    document.getElementById("fovClientSettingsTab").classList.add("active");
  }
  document.getElementById("generalClientSettings").style.display = "none";
  document.getElementById("mouseSensitivtyClientSettings").style.display =
    "none";
  document.getElementById("fovClientSettings").style.display = "flex";
}
function minusMouseSens(multiplier, min, step) {
  var x = parseFloat(document.getElementById(multiplier).value) - step;
  x = Number(x.toFixed(4));
  if (x >= min) {
    document.getElementById(multiplier).value = x;
  } else {
    document.getElementById(multiplier).value = min;
  }
}
function plusMouseSens(multiplier, max, step) {
  var x = parseFloat(document.getElementById(multiplier).value) + step;
  x = Number(x.toFixed(6));
  if (x <= max) {
    document.getElementById(multiplier).value = x;
  } else {
    document.getElementById(multiplier).value = max;
  }
}
function minus(multiplier, min, step) {
  var x = parseFloat(document.getElementById(multiplier).value) - step;
  x = Number(x.toFixed(4));
  if (x >= min) {
    document.getElementById(multiplier).value = x;
  } else {
    document.getElementById(multiplier).value = min;
  }
}
function plus(multiplier, max, step) {
  var x = parseFloat(document.getElementById(multiplier).value) + step;
  x = Number(x.toFixed(4));
  if (x <= max) {
    document.getElementById(multiplier).value = x;
  } else {
    document.getElementById(multiplier).value = max;
  }
}
function onOff(id) {
  if (document.getElementById(id).innerHTML == "On") {
    document.getElementById(id).innerHTML = "Off";
  } else {
    document.getElementById(id).innerHTML = "On";
  }
}
function setDefaultVoipVolume(volume) {
  document.getElementById("defaultVoipVolumeSettingsElement").style.display =
    "block";
  document.getElementById("defaultVoipVolume").value = volume;
}
function setPlayerVoipLevel(level) {
  document.getElementById("playerVoipLevelSettingsElement").style.display =
    "block";
  document.getElementById("playerVoipLevel").innerHTML = level;
}
function plusPlayerVoipLevel() {
  if (document.getElementById("playerVoipLevel").innerHTML == "Squad") {
    document.getElementById("playerVoipLevel").innerHTML = "Team";
  } else if (document.getElementById("playerVoipLevel").innerHTML == "Team") {
    document.getElementById("playerVoipLevel").innerHTML = "Disabled";
  } else {
    document.getElementById("playerVoipLevel").innerHTML = "Squad";
  }
}
function minusPlayerVoipLevel() {
  if (document.getElementById("playerVoipLevel").innerHTML == "Squad") {
    document.getElementById("playerVoipLevel").innerHTML = "Disabled";
  } else if (
    document.getElementById("playerVoipLevel").innerHTML == "Disabled"
  ) {
    document.getElementById("playerVoipLevel").innerHTML = "Team";
  } else {
    document.getElementById("playerVoipLevel").innerHTML = "Squad";
  }
}
function applyGeneralClientSettings() {
  if (document.getElementById("scoreboardMethod").innerHTML == "Hold Tab") {
    WebUI.Call("DispatchEvent", "WebUI:HoldScoreboard");
  } else {
    WebUI.Call("DispatchEvent", "WebUI:ClickScoreboard");
  }
  if (document.getElementById("showPing").innerHTML == "No") {
    document.getElementById("showLocalPing").style.display = "none";
    WebUI.Call("DispatchEvent", "WebUI:HidePing");
  } else {
    document.getElementById("showLocalPing").style.display = "flex";
    WebUI.Call("DispatchEvent", "WebUI:ShowPing");
  }
  if (document.getElementById("hideVotings").innerHTML == "No") {
    showHideVotings = true;
    if (isVoteInProgress == true) {
      document.getElementById("votepopup").classList.add("shown"); biaPinVotePopup();
    }
  } else {
    showHideVotings = false;
    document.getElementById("votepopup").classList.remove("shown");
  }
  if (document.getElementById("defaultMinimapSize").innerHTML == "Small") {
    WebUI.Call("DispatchEvent", "WebUI:SmallMiniMapSize");
  } else {
    WebUI.Call("DispatchEvent", "WebUI:LargeMiniMapSize");
  }
  channelsMuted = [];
  if (document.getElementById("adminChannel").innerHTML == "Off") {
    channelsMuted.push("4");
  }
  if (document.getElementById("allChannel").innerHTML == "Off") {
    channelsMuted.push("0");
  }
  if (document.getElementById("teamChannel").innerHTML == "Off") {
    channelsMuted.push("1");
  }
  if (document.getElementById("squadChannel").innerHTML == "Off") {
    channelsMuted.push("2");
  }
  WebUI.Call(
    "DispatchEvent",
    "WebUI:ChatChannels",
    JSON.stringify(channelsMuted)
  );
  WebUI.Call(
    "DispatchEvent",
    "VoipMod:SetDefaultVolume",
    document.getElementById("defaultVoipVolume").value
  );
  WebUI.Call(
    "DispatchEvent",
    "VoipMod:PlayerVoipLevel",
    document.getElementById("playerVoipLevel").innerHTML
  );
  closeSmart();
}
function resetGeneralClientSettings() {
  document.getElementById("scoreboardMethod").innerHTML = "Hold Tab";
  WebUI.Call("DispatchEvent", "WebUI:HoldScoreboard");

  document.getElementById("showPing").innerHTML = "No";
  document.getElementById("showLocalPing").style.display = "none";
  WebUI.Call("DispatchEvent", "WebUI:HidePing");
  document.getElementById("defaultMinimapSize").innerHTML = "Small";
  document.getElementById("hideVotings").innerHTML = "No";
  showHideVotings = true;
  if (isVoteInProgress == true) {
    document.getElementById("votepopup").classList.add("shown"); biaPinVotePopup();
  }

  channelsMuted = [];
  document.getElementById("adminChannel").innerHTML = "On";
  document.getElementById("allChannel").innerHTML = "On";
  document.getElementById("teamChannel").innerHTML = "On";
  document.getElementById("squadChannel").innerHTML = "On";
  WebUI.Call(
    "DispatchEvent",
    "WebUI:ChatChannels",
    JSON.stringify(channelsMuted)
  );
  WebUI.Call("DispatchEvent", "WebUI:SmallMinimapSize");

  closeSmart();
}
/* Endregion */

/* Region show/hide localPlayer ping */
function showLocalPlayerPing() {
  document.getElementById("showPing").innerHTML = "Yes";
  document.getElementById("showLocalPing").style.display = "flex";
}

function hideLocalPlayerPing() {
  document.getElementById("showPing").innerHTML = "No";
  document.getElementById("showLocalPing").style.display = "none";
}
/* Endregion */

/* Region Update localPlayer ping */
function updateLocalPlayerPing(ping) {
  localPing = ping;
  document.getElementById("showLocalPing").innerHTML =
    "<p>Ping: <span>" + localPing + " ms</span></p>";
}
/* Endregion */

/* Region admin map rotation */
function mapRotationSetup() {
  biaSetActiveTab("mapRotationTab");
  document.getElementById("serverSetupSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  if (document.getElementById("serverInfoTab").classList.contains("active")) {
    document.getElementById("serverInfoTab").classList.remove("active");
  }
  if (document.getElementById("scoreboardTab").classList.contains("active")) {
    document.getElementById("scoreboardTab").classList.remove("active");
  }
  if (document.getElementById("settingsTab").classList.contains("active")) {
    document.getElementById("settingsTab").classList.remove("active");
  }
  if (
    document.getElementById("mapRotationTab").classList.contains("active") ==
    false
  ) {
    document.getElementById("mapRotationTab").classList.add("active");
  }
  document.getElementById("mapRotationTab").style.display = "flex";
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("tables").style.display = "none";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("mapRotationSettings").style.display = "flex";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";

  /* markers are CSS triangles; fb:// srcs removed (threw when the div was absent) */

  biaEnsureQueuePanel();
  WebUI.Call("DispatchEvent", "WebUI:GetMapQueue");
}

function getCurrentMapRotation(args) {
  if (!args || !args[0]) return;
  var idx = args[1] || [];
  biaAdvanceQueue(idx[0]);
  biaBuildMapLists(args[0], idx[0], idx[1]);
}
function setNextMap(mapIndex) {
  WebUI.Call("DispatchEvent", "WebUI:SetNextMap", JSON.stringify(mapIndex));
}
function nextRound() {
  biaFlushQueueSave();
  WebUI.Call("DispatchEvent", "WebUI:RunNextRound");
}
function restart() {
  biaFlushQueueSave();
  WebUI.Call("DispatchEvent", "WebUI:RestartRound");
}
/* Endregion */

/* Region admin server setup (work in progress)*/
function serverSetup() {
  biaSetActiveTab("serverSetupTab");
  document.getElementById("mapRotationSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  /* keyboard is taken when a field is clicked (biaKb) */
  if (document.getElementById("serverInfoTab").classList.contains("active")) {
    document.getElementById("serverInfoTab").classList.remove("active");
  }
  if (document.getElementById("scoreboardTab").classList.contains("active")) {
    document.getElementById("scoreboardTab").classList.remove("active");
  }
  if (document.getElementById("settingsTab").classList.contains("active")) {
    document.getElementById("settingsTab").classList.remove("active");
  }
  if (
    document.getElementById("serverSetupTab").classList.contains("active") ==
    false
  ) {
    document.getElementById("serverSetupTab").classList.add("active");
  }
  document.getElementById("serverSetupTab").style.display = "flex";
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("tables").style.display = "none";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("serverSetupSettings").style.display = "flex";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  WebUI.Call("DispatchEvent", "WebUI:GetServerSetupSettings");
}

function getServerSetupSettings(args) {
  document.getElementById("serverSetupServerName").value = args[0];
  document.getElementById("serverSetupServerDescription").value = args[1];
  document.getElementById("serverSetupServerMessage").value = args[2];
  document.getElementById("serverSetupServerPassword").value = args[3];
}

function saveServerSetup() {
  serverSetupArray = [];
  serverSetupArray.push(document.getElementById("serverSetupServerName").value);
  serverSetupArray.push(
    document.getElementById("serverSetupServerDescription").value
  );
  serverSetupArray.push(
    document.getElementById("serverSetupServerMessage").value
  );
  serverSetupArray.push(
    document.getElementById("serverSetupServerPassword").value
  );

  WebUI.Call(
    "DispatchEvent",
    "WebUI:SaveServerSetupSettings",
    JSON.stringify(serverSetupArray)
  );
  applyManagePresets();
  closeSmart();
}
/* Endregion*/

/* Region Manage Presets*/
function managePresets() {
  biaKbRelease();
  /*if ( document.getElementById("serverInfoTab").classList.contains('active') )
	{
		document.getElementById("serverInfoTab").classList.remove('active');
	}
	if ( document.getElementById("scoreboardTab").classList.contains('active') )
	{
		document.getElementById("scoreboardTab").classList.remove('active');
	}
	if ( document.getElementById("settingsTab").classList.contains('active') )
	{
		document.getElementById("settingsTab").classList.remove('active');
	}
	if ( document.getElementById("serverSetupTab").classList.contains('active') )
	{
		document.getElementById("serverSetupTab").classList.remove('active');
	}
	if ( document.getElementById("managePresetsTab").classList.contains('active') == false )
	{
		document.getElementById("managePresetsTab").classList.add('active');
	}
	document.getElementById("settingsTab").style.display = "none";
	document.getElementById("serverSetupTab").style.display = "flex";*/
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("tables").style.display = "none";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("serverSetupSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "flex";
  WebUI.Call("DispatchEvent", "WebUI:GetPresetsSettings");
}
function getPresetsSettings(args) {
  /*document.getElementById("serverSetupServerName").value = args[0];
	document.getElementById("serverSetupServerDescription").value = args[1];
	document.getElementById("serverSetupServerMessage").value = args[2];
	document.getElementById("serverSetupServerPassword").value = args[3];*/
}

function applyManagePresets() {
  applyManagePresetsArray = [];
  if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Normal"
  ) {
    applyManagePresetsArray.push("normal");
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Hardcore"
  ) {
    applyManagePresetsArray.push("hardcore");
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Infantry"
  ) {
    applyManagePresetsArray.push("infantry");
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Hardcore No Map"
  ) {
    applyManagePresetsArray.push("hardcoreNoMap");
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Custom"
  ) {
    applyManagePresetsArray.push("custom");
    if (
      document.getElementById("customPresetFriendlyFire").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    applyManagePresetsArray.push(
      document.getElementById("customPresetIdleTimeout").innerHTML
    );
    if (document.getElementById("customPresetAutobalance").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    applyManagePresetsArray.push(
      document.getElementById("customPresetTeamKillCountForKick").innerHTML
    );
    applyManagePresetsArray.push(
      document.getElementById("customPresetTeamKillKicksForBan").innerHTML
    );
    if (
      document.getElementById("customPresetVehicleSpawn").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPresetRegenerateHealth").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPresetOnlySquadLeaderSpawn").innerHTML ==
      "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (document.getElementById("customPresetMiniMap").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (document.getElementById("customPresetHUD").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPresetMinimapSpotting").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (document.getElementById("customPreset3dSpotting").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (document.getElementById("customPresetKillCam").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPreset3rdPersonCam").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (document.getElementById("customPresetNameTag").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "Normal"
    ) {
      applyManagePresetsArray.push("0");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "EU Arms Race"
    ) {
      applyManagePresetsArray.push("8");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "RU Arms Race"
    ) {
      applyManagePresetsArray.push("7");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "US Arms Race"
    ) {
      applyManagePresetsArray.push("6");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "Snipers Heaven"
    ) {
      applyManagePresetsArray.push("5");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "Pistols Only"
    ) {
      applyManagePresetsArray.push("4");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "Heavy Gear"
    ) {
      applyManagePresetsArray.push("3");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "Light Weight"
    ) {
      applyManagePresetsArray.push("2");
    } else if (
      document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
      "Normal Reversed"
    ) {
      applyManagePresetsArray.push("1");
    }
    applyManagePresetsArray.push(
      document.getElementById("customPresetCtfRoundTimeModifier").innerHTML
    );
    applyManagePresetsArray.push(
      document.getElementById("customPresetPlayerRespawnTime").innerHTML
    );
    applyManagePresetsArray.push(
      document.getElementById("customPresetPlayerManDownTime").innerHTML
    );
    applyManagePresetsArray.push(
      document.getElementById("customPresetPlayerHealth").innerHTML
    );
    applyManagePresetsArray.push(
      document.getElementById("customPresetBulletDamage").innerHTML
    );
    if (document.getElementById("customPresetBluetint").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (document.getElementById("customPresetSunFlare").innerHTML == "Yes") {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    applyManagePresetsArray.push(
      document.getElementById("customPresetSuppressionMultiplier").innerHTML
    );
    let timeScaling =
      document.getElementById("customPresetTimeScale").innerHTML / 100;
    applyManagePresetsArray.push(timeScaling);
    if (
      document.getElementById("customPresetAllowDeserting").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPresetDestructionEnabled").innerHTML ==
      "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    if (
      document.getElementById("customPresetVehicleDisabling").innerHTML == "Yes"
    ) {
      applyManagePresetsArray.push("true");
    } else {
      applyManagePresetsArray.push("false");
    }
    applyManagePresetsArray.push(
      document.getElementById("customPresetSquadSize").innerHTML
    );
  }
  WebUI.Call(
    "DispatchEvent",
    "WebUI:ApplyManagePresets",
    JSON.stringify(applyManagePresetsArray)
  );
  closeSmart();
}

function minusPreset() {
  if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Normal"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Custom";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Custom";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "flex";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Custom"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML =
      "Hardcore No Map";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Hardcore No Map";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "flex";
    document.getElementById("presetCustom").style.display = "none";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Hardcore No Map"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Infantry";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Infantry";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "flex";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Infantry"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Hardcore";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Hardcore";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "flex";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Hardcore"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Normal";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Normal";
    document.getElementById("presetNormal").style.display = "flex";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  }
}
function plusPreset() {
  if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Normal"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Hardcore";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Hardcore";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "flex";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Hardcore"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Infantry";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Infantry";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "flex";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Infantry"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML =
      "Hardcore No Map";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Hardcore No Map";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "flex";
    document.getElementById("presetCustom").style.display = "none";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Hardcore No Map"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Custom";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Custom";
    document.getElementById("presetNormal").style.display = "none";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "flex";
  } else if (
    document.getElementById("currentPresetInManagePresets").innerHTML ==
    "Custom"
  ) {
    document.getElementById("serverSetupCurrentPreset").innerHTML = "Normal";
    document.getElementById("currentPresetInManagePresets").innerHTML =
      "Normal";
    document.getElementById("presetNormal").style.display = "flex";
    document.getElementById("presetHardcore").style.display = "none";
    document.getElementById("presetInfantry").style.display = "none";
    document.getElementById("presetHardcoreNoMap").style.display = "none";
    document.getElementById("presetCustom").style.display = "none";
  }
}

function yesNoPreset(arg) {
  if (document.getElementById(arg).innerHTML == "No") {
    document.getElementById(arg).innerHTML = "Yes";
  } else {
    document.getElementById(arg).innerHTML = "No";
  }
}

function valuePresetMinus(arg) {
  if (arg == "customPresetIdleTimeout") {
    if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "200";
    } else if (document.getElementById(arg).innerHTML == "200") {
      document.getElementById(arg).innerHTML = "120";
    } else if (document.getElementById(arg).innerHTML == "120") {
      document.getElementById(arg).innerHTML = "900";
    } else if (document.getElementById(arg).innerHTML == "900") {
      document.getElementById(arg).innerHTML = "800";
    } else if (document.getElementById(arg).innerHTML == "800") {
      document.getElementById(arg).innerHTML = "700";
    } else if (document.getElementById(arg).innerHTML == "700") {
      document.getElementById(arg).innerHTML = "600";
    } else if (document.getElementById(arg).innerHTML == "600") {
      document.getElementById(arg).innerHTML = "500";
    } else if (document.getElementById(arg).innerHTML == "500") {
      document.getElementById(arg).innerHTML = "400";
    } else {
      document.getElementById(arg).innerHTML = "300";
    }
  } else if (
    arg == "customPresetCtfRoundTimeModifier" ||
    arg == "customPresetPlayerHealth" ||
    arg == "customPresetBulletDamage"
  ) {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "90";
    } else if (document.getElementById(arg).innerHTML == "90") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "500";
    } else if (document.getElementById(arg).innerHTML == "500") {
      document.getElementById(arg).innerHTML = "400";
    } else if (document.getElementById(arg).innerHTML == "400") {
      document.getElementById(arg).innerHTML = "300";
    } else if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "200";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  } else if (arg == "customPresetPlayerRespawnTime") {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "90";
    } else if (document.getElementById(arg).innerHTML == "90") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "300";
    } else if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "200";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  } else if (
    arg == "customPresetPlayerManDownTime" ||
    arg == "customPresetSuppressionMultiplier"
  ) {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "90";
    } else if (document.getElementById(arg).innerHTML == "90") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "300";
    } else if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "200";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  } else if (arg == "customPresetTimeScale") {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "90";
    } else if (document.getElementById(arg).innerHTML == "90") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "200";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  }
}

function valuePresetPlus(arg) {
  if (arg == "customPresetIdleTimeout") {
    if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "400";
    } else if (document.getElementById(arg).innerHTML == "400") {
      document.getElementById(arg).innerHTML = "500";
    } else if (document.getElementById(arg).innerHTML == "500") {
      document.getElementById(arg).innerHTML = "600";
    } else if (document.getElementById(arg).innerHTML == "600") {
      document.getElementById(arg).innerHTML = "700";
    } else if (document.getElementById(arg).innerHTML == "700") {
      document.getElementById(arg).innerHTML = "800";
    } else if (document.getElementById(arg).innerHTML == "800") {
      document.getElementById(arg).innerHTML = "900";
    } else if (document.getElementById(arg).innerHTML == "900") {
      document.getElementById(arg).innerHTML = "120";
    } else if (document.getElementById(arg).innerHTML == "120") {
      document.getElementById(arg).innerHTML = "200";
    } else {
      document.getElementById(arg).innerHTML = "300";
    }
  } else if (
    arg == "customPresetCtfRoundTimeModifier" ||
    arg == "customPresetPlayerHealth" ||
    arg == "customPresetBulletDamage"
  ) {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "200";
    } else if (document.getElementById(arg).innerHTML == "200") {
      document.getElementById(arg).innerHTML = "300";
    } else if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "400";
    } else if (document.getElementById(arg).innerHTML == "400") {
      document.getElementById(arg).innerHTML = "500";
    } else if (document.getElementById(arg).innerHTML == "500") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "90";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  } else if (arg == "customPresetPlayerRespawnTime") {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "200";
    } else if (document.getElementById(arg).innerHTML == "200") {
      document.getElementById(arg).innerHTML = "300";
    } else if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "90";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  } else if (
    arg == "customPresetPlayerManDownTime" ||
    arg == "customPresetSuppressionMultiplier"
  ) {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "200";
    } else if (document.getElementById(arg).innerHTML == "200") {
      document.getElementById(arg).innerHTML = "300";
    } else if (document.getElementById(arg).innerHTML == "300") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "90";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  } else if (arg == "customPresetTimeScale") {
    if (document.getElementById(arg).innerHTML == "100") {
      document.getElementById(arg).innerHTML = "200";
    } else if (document.getElementById(arg).innerHTML == "200") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "90";
    } else {
      document.getElementById(arg).innerHTML = "100";
    }
  }
}

function numberPresetMinus(arg) {
  if (arg == "customPresetTeamKillCountForKick") {
    if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "15";
    } else if (document.getElementById(arg).innerHTML == "15") {
      document.getElementById(arg).innerHTML = "14";
    } else if (document.getElementById(arg).innerHTML == "14") {
      document.getElementById(arg).innerHTML = "13";
    } else if (document.getElementById(arg).innerHTML == "13") {
      document.getElementById(arg).innerHTML = "12";
    } else if (document.getElementById(arg).innerHTML == "12") {
      document.getElementById(arg).innerHTML = "11";
    } else if (document.getElementById(arg).innerHTML == "11") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "3";
    } else {
      document.getElementById(arg).innerHTML = "2";
    }
  } else if (arg == "customPresetTeamKillKicksForBan") {
    if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "99";
    } else if (document.getElementById(arg).innerHTML == "99") {
      document.getElementById(arg).innerHTML = "90";
    } else if (document.getElementById(arg).innerHTML == "90") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "2";
    } else {
      document.getElementById(arg).innerHTML = "1";
    }
  } else if (arg == "customPresetSquadSize") {
    if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "16";
    } else if (document.getElementById(arg).innerHTML == "16") {
      document.getElementById(arg).innerHTML = "15";
    } else if (document.getElementById(arg).innerHTML == "15") {
      document.getElementById(arg).innerHTML = "14";
    } else if (document.getElementById(arg).innerHTML == "14") {
      document.getElementById(arg).innerHTML = "13";
    } else if (document.getElementById(arg).innerHTML == "13") {
      document.getElementById(arg).innerHTML = "12";
    } else if (document.getElementById(arg).innerHTML == "12") {
      document.getElementById(arg).innerHTML = "11";
    } else if (document.getElementById(arg).innerHTML == "11") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "5";
    } else {
      document.getElementById(arg).innerHTML = "4";
    }
  }
}

function numberPresetPlus(arg) {
  if (arg == "customPresetTeamKillCountForKick") {
    if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "11";
    } else if (document.getElementById(arg).innerHTML == "11") {
      document.getElementById(arg).innerHTML = "12";
    } else if (document.getElementById(arg).innerHTML == "12") {
      document.getElementById(arg).innerHTML = "13";
    } else if (document.getElementById(arg).innerHTML == "13") {
      document.getElementById(arg).innerHTML = "14";
    } else if (document.getElementById(arg).innerHTML == "14") {
      document.getElementById(arg).innerHTML = "15";
    } else {
      document.getElementById(arg).innerHTML = "2";
    }
  } else if (arg == "customPresetTeamKillKicksForBan") {
    if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "3";
    } else if (document.getElementById(arg).innerHTML == "3") {
      document.getElementById(arg).innerHTML = "4";
    } else if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "20";
    } else if (document.getElementById(arg).innerHTML == "20") {
      document.getElementById(arg).innerHTML = "30";
    } else if (document.getElementById(arg).innerHTML == "30") {
      document.getElementById(arg).innerHTML = "40";
    } else if (document.getElementById(arg).innerHTML == "40") {
      document.getElementById(arg).innerHTML = "50";
    } else if (document.getElementById(arg).innerHTML == "50") {
      document.getElementById(arg).innerHTML = "60";
    } else if (document.getElementById(arg).innerHTML == "60") {
      document.getElementById(arg).innerHTML = "70";
    } else if (document.getElementById(arg).innerHTML == "70") {
      document.getElementById(arg).innerHTML = "80";
    } else if (document.getElementById(arg).innerHTML == "80") {
      document.getElementById(arg).innerHTML = "90";
    } else if (document.getElementById(arg).innerHTML == "90") {
      document.getElementById(arg).innerHTML = "99";
    } else {
      document.getElementById(arg).innerHTML = "1";
    }
  } else if (arg == "customPresetSquadSize") {
    if (document.getElementById(arg).innerHTML == "4") {
      document.getElementById(arg).innerHTML = "5";
    } else if (document.getElementById(arg).innerHTML == "5") {
      document.getElementById(arg).innerHTML = "6";
    } else if (document.getElementById(arg).innerHTML == "6") {
      document.getElementById(arg).innerHTML = "7";
    } else if (document.getElementById(arg).innerHTML == "7") {
      document.getElementById(arg).innerHTML = "8";
    } else if (document.getElementById(arg).innerHTML == "8") {
      document.getElementById(arg).innerHTML = "9";
    } else if (document.getElementById(arg).innerHTML == "9") {
      document.getElementById(arg).innerHTML = "10";
    } else if (document.getElementById(arg).innerHTML == "10") {
      document.getElementById(arg).innerHTML = "11";
    } else if (document.getElementById(arg).innerHTML == "11") {
      document.getElementById(arg).innerHTML = "12";
    } else if (document.getElementById(arg).innerHTML == "12") {
      document.getElementById(arg).innerHTML = "13";
    } else if (document.getElementById(arg).innerHTML == "13") {
      document.getElementById(arg).innerHTML = "14";
    } else if (document.getElementById(arg).innerHTML == "14") {
      document.getElementById(arg).innerHTML = "15";
    } else if (document.getElementById(arg).innerHTML == "15") {
      document.getElementById(arg).innerHTML = "16";
    } else if (document.getElementById(arg).innerHTML == "16") {
      document.getElementById(arg).innerHTML = "1";
    } else if (document.getElementById(arg).innerHTML == "1") {
      document.getElementById(arg).innerHTML = "2";
    } else if (document.getElementById(arg).innerHTML == "2") {
      document.getElementById(arg).innerHTML = "3";
    } else {
      document.getElementById(arg).innerHTML = "4";
    }
  }
}

function gunmasterWeaponsMinus() {
  if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Normal"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "EU Arms Race";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "EU Arms Race"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "RU Arms Race";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "RU Arms Race"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "US Arms Race";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "US Arms Race"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Snipers Heaven";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Snipers Heaven"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Pistols Only";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Pistols Only"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Heavy Gear";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Heavy Gear"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Light Weight";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Light Weight"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Normal Reversed";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Normal Reversed"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Normal";
  }
}

function gunmasterWeaponsPlus() {
  if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Normal"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Normal Reversed";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Normal Reversed"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Light Weight";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Light Weight"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Heavy Gear";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Heavy Gear"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Pistols Only";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Pistols Only"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Snipers Heaven";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "Snipers Heaven"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "US Arms Race";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "US Arms Race"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "RU Arms Race";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "RU Arms Race"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "EU Arms Race";
  } else if (
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML ==
    "EU Arms Race"
  ) {
    document.getElementById("customPresetGunmasterWeaponsPreset").innerHTML =
      "Normal";
  }
}
/* Endregion */

/* Region Manage Mod Settings */
function manageModSettings() {
  biaKbRelease();
  document.getElementById("serverInfo").style.display = "none";
  document.getElementById("tables").style.display = "none";
  document.getElementById("clientSettings").style.display = "none";
  document.getElementById("serverSetupSettings").style.display = "none";
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "flex";
  //WebUI.Call('DispatchEvent', 'WebUI:GetPresetsSettings');
}

function toggleEnemyCorpsesScoreboard() {
  if (document.getElementById("showEnemyCorpses").innerHTML == "Yes") {
    document.getElementById("showEnemyCorpses").innerHTML = "No";
  } else {
    document.getElementById("showEnemyCorpses").innerHTML = "Yes";
  }
}

function plusVoteDuration() {
  let newValue =
    parseInt(document.getElementById("showVoteDuration").innerHTML) + 15;
  document.getElementById("showVoteDuration").innerHTML = newValue;
}
function plusCooldownBetweenVotes() {
  let newValue =
    parseInt(document.getElementById("showCooldownBetweenVotes").innerHTML) +
    15;
  document.getElementById("showCooldownBetweenVotes").innerHTML = newValue;
}
function plusMaxVotingStartsPerPlayer() {
  let newValue =
    parseInt(
      document.getElementById("showMaxVotingStartsPerPlayer").innerHTML
    ) + 1;
  document.getElementById("showMaxVotingStartsPerPlayer").innerHTML = newValue;
}
function plusVotingParticipation() {
  let newValue =
    parseInt(
      document.getElementById("showMaxVotingParticipationNeeded").innerHTML
    ) + 1;
  document.getElementById("showMaxVotingParticipationNeeded").innerHTML =
    newValue;
}
function minusVoteDuration() {
  let newValue =
    parseInt(document.getElementById("showVoteDuration").innerHTML) - 15;
  if (newValue >= 0) {
    document.getElementById("showVoteDuration").innerHTML = newValue;
  } else {
    document.getElementById("showVoteDuration").innerHTML = "0";
  }
}
function minusCooldownBetweenVotes() {
  let newValue =
    parseInt(document.getElementById("showCooldownBetweenVotes").innerHTML) -
    15;
  if (newValue >= 0) {
    document.getElementById("showCooldownBetweenVotes").innerHTML = newValue;
  } else {
    document.getElementById("showCooldownBetweenVotes").innerHTML = "0";
  }
}
function minusMaxVotingStartsPerPlayer() {
  let newValue =
    parseInt(
      document.getElementById("showMaxVotingStartsPerPlayer").innerHTML
    ) - 1;
  if (newValue >= 0) {
    document.getElementById("showMaxVotingStartsPerPlayer").innerHTML =
      newValue;
  } else {
    document.getElementById("showMaxVotingStartsPerPlayer").innerHTML = "0";
  }
}
function minusVotingParticipation() {
  let newValue =
    parseInt(
      document.getElementById("showMaxVotingParticipationNeeded").innerHTML
    ) - 1;
  if (newValue >= 0) {
    document.getElementById("showMaxVotingParticipationNeeded").innerHTML =
      newValue;
  } else {
    document.getElementById("showMaxVotingParticipationNeeded").innerHTML = "0";
  }
}
function toggleEnableAssist() {
  if (document.getElementById("showEnableAssistFunction").innerHTML == "On") {
    document.getElementById("showEnableAssistFunction").innerHTML = "Off";
  } else {
    document.getElementById("showEnableAssistFunction").innerHTML = "On";
  }
}
function toggleShowLoadingScreenInfo() {
  if (document.getElementById("showLoadingScreenInfo").innerHTML == "Yes") {
    document.getElementById("showLoadingScreenInfo").innerHTML = "No";
  } else {
    document.getElementById("showLoadingScreenInfo").innerHTML = "Yes";
  }
}
function resetGeneralModSettings() {
  document.getElementById("showEnemyCorpses").innerHTML = "Yes";
  document.getElementById("showVoteDuration").innerHTML = "30";
  document.getElementById("showCooldownBetweenVotes").innerHTML = "0";
  document.getElementById("showMaxVotingStartsPerPlayer").innerHTML = "3";
  document.getElementById("showMaxVotingParticipationNeeded").innerHTML = "50";
  document.getElementById("showEnableAssistFunction").innerHTML = "On";
  document.getElementById("showLoadingScreenInfo").innerHTML = "Yes";

  WebUI.Call("DispatchEvent", "WebUI:ResetGeneralModSettings");
  closeSmart();
}
function resetAndSaveGeneralModSettings() {
  document.getElementById("showEnemyCorpses").innerHTML = "Yes";
  document.getElementById("showVoteDuration").innerHTML = "30";
  document.getElementById("showCooldownBetweenVotes").innerHTML = "0";
  document.getElementById("showMaxVotingStartsPerPlayer").innerHTML = "3";
  document.getElementById("showMaxVotingParticipationNeeded").innerHTML = "50";
  document.getElementById("showEnableAssistFunction").innerHTML = "On";
  document.getElementById("showLoadingScreenInfo").innerHTML = "Yes";

  WebUI.Call("DispatchEvent", "WebUI:ResetAndSaveGeneralModSettings");
  closeSmart();
}
function applyGeneralModSettings() {
  modSettings = [];
  if (document.getElementById("showEnemyCorpses").innerHTML == "Yes") {
    modSettings.push(true);
  } else {
    modSettings.push(false);
  }
  modSettings.push(document.getElementById("showVoteDuration").innerHTML);
  modSettings.push(
    document.getElementById("showCooldownBetweenVotes").innerHTML
  );
  modSettings.push(
    document.getElementById("showMaxVotingStartsPerPlayer").innerHTML
  );
  modSettings.push(
    document.getElementById("showMaxVotingParticipationNeeded").innerHTML
  );
  if (document.getElementById("showEnableAssistFunction").innerHTML == "On") {
    modSettings.push(true);
  } else {
    modSettings.push(false);
  }
  if (document.getElementById("showLoadingScreenInfo").innerHTML == "Yes") {
    modSettings.push(true);
  } else {
    modSettings.push(false);
  }
  WebUI.Call(
    "DispatchEvent",
    "WebUI:ApplyGeneralModSettings",
    JSON.stringify(modSettings)
  );
  closeSmart();
}
function saveGeneralModSettings() {
  modSettings = [];
  if (document.getElementById("showEnemyCorpses").innerHTML == "Yes") {
    modSettings.push(true);
  } else {
    modSettings.push(false);
  }
  modSettings.push(document.getElementById("showVoteDuration").innerHTML);
  modSettings.push(
    document.getElementById("showCooldownBetweenVotes").innerHTML
  );
  modSettings.push(
    document.getElementById("showMaxVotingStartsPerPlayer").innerHTML
  );
  modSettings.push(
    document.getElementById("showMaxVotingParticipationNeeded").innerHTML
  );
  if (document.getElementById("showEnableAssistFunction").innerHTML == "On") {
    modSettings.push(true);
  } else {
    modSettings.push(false);
  }
  if (document.getElementById("showLoadingScreenInfo").innerHTML == "Yes") {
    modSettings.push(true);
  } else {
    modSettings.push(false);
  }
  WebUI.Call(
    "DispatchEvent",
    "WebUI:SaveGeneralModSettings",
    JSON.stringify(modSettings)
  );
  closeSmart();
}
function refreshModSettings(args) {
  if (args[0] == true) {
    document.getElementById("showEnemyCorpses").innerHTML = "Yes";
  } else {
    document.getElementById("showEnemyCorpses").innerHTML = "No";
  }
  document.getElementById("showVoteDuration").innerHTML = args[1];
  document.getElementById("showCooldownBetweenVotes").innerHTML = args[2];
  document.getElementById("showMaxVotingStartsPerPlayer").innerHTML = args[3];
  document.getElementById("showMaxVotingParticipationNeeded").innerHTML =
    args[4];
  enableAssistFunction = args[5];
  if (args[5] == true) {
    document.getElementById("showEnableAssistFunction").innerHTML = "On";
  } else {
    document.getElementById("showEnableAssistFunction").innerHTML = "Off";
  }
  if (args[6] == true) {
    document.getElementById("showLoadingScreenInfo").innerHTML = "Yes";
  } else {
    document.getElementById("showLoadingScreenInfo").innerHTML = "No";
  }
}
/* Endregion */

/* Region ServerBanner Loading Screen */
function info(args) {
  document.getElementById("bannerHeader").innerHTML = "<p>" + args[0] + "</p>";
  document.getElementById("bannerDescription").innerHTML =
    "<p>" + args[1] + "</p>";
  if (args[2] != null) {
    document.getElementById("bannerImgSrc").style.backgroundImage =
      'url("' + args[2] + '")';
    document.getElementById("serverInfoBannerImgSrc").style.backgroundImage =
      'url("' + args[2] + '")';
  }
}
function hideLoadingScreen() {
  document.getElementById("banner").style.display = "none";
}

function showLoadingScreen() {
  document.getElementById("banner").style.display = "flex";
}
/* Endregion */

/* Region ServerOwner Quick Server Setup */
function quickServerSetup() {
  //document.getElementById("quickSetupPopup").style.display = "flex";
}
/* Endregion */

function escapestring(stringToEscape, withBackSlash) {
  stringToEscape = stringToEscape.replace(/\&/g, "&amp;");
  stringToEscape = stringToEscape.replace(/\</g, "&lt;");
  stringToEscape = stringToEscape.replace(/\>/g, "&gt;");
  stringToEscape = stringToEscape.replace(/\"/g, "&quot;");
  stringToEscape = stringToEscape.replace(/\'/g, "&#39;");

  if (withBackSlash == true) {
    stringToEscape = stringToEscape.replace(/\\/g, "&#92;&#92;");
  } else {
    stringToEscape = stringToEscape.replace(/\\/g, "&#92;");
  }
  return stringToEscape;
}

/* Gameface: <input type="checkbox"> is unsupported, these are div switches. */
function toggleBiaCheck(el) {
  if (el.classList.contains("checked")) {
    el.classList.remove("checked");
  } else {
    el.classList.add("checked");
  }
}

/* ==========================================================================
   Map rotation queue + Manage Map Rotation + Ban/Admin lists + map vote
   Server owns the queue; silent autosave 10s after last edit.
   ========================================================================== */
var biaMapQueue = [];
var biaQueueRandom = false;
var biaLastCurrentMap = null;
var biaSaveTimer = null;
var biaRotationMode = "Startup";
var biaListMode = "bans";
var biaBanList = [];
var biaAdminList = [];
var biaTipTimer = null;
var biaMapVoteActive = false;
var biaSuppressRestoreUntil = 0;
var biaLocalDirty = false;

function biaQueueHeaderHtml() {
  if (biaIsMapAdmin()) {
    return (
      '<div id="mapQueueHeader">Next Map Queue' +
      '<div id="mapQueueRandom" class="mapQueueToggle" onclick="biaToggleRandom()">' +
      '<div class="mapQueueToggleBox"></div>Random</div>' +
      '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Add every map from the list (respects the mode filter)" onclick="biaQueueAllMaps()">+All</div>' +
      '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Shuffle the queue once" onclick="biaShuffleQueue()">Mix</div>' +
      '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Announce the next maps in chat to all players" onclick="biaAnnounceQueue()">!</div>' +
      '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Load the queue head (orange row) right now" onclick="biaForceNextFromQueue()">&gt;&gt;</div>' +
      '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Clear the entire map queue" onclick="biaClearQueue()">X</div>' +
      "</div>"
    );
  }
  return (
    '<div id="mapQueueHeader">Next Map Queue' +
    '<div id="mapQueueRandom" class="mapQueueToggle mapQueueToggleDisabled">' +
    '<div class="mapQueueToggleBox"></div>Random</div></div>'
  );
}

function biaEnsureQueuePanel() {
  var panel = biaById("mapQueuePanel");
  if (!panel) {
    var anchor = biaById("mapRotationNextMap");
    var host = null;
    var after = null;
    if (anchor && anchor.parentNode && anchor.parentNode.parentNode) {
      after = anchor.parentNode;
      host = after.parentNode;
    } else {
      host = biaById("mapRotationSettings");
    }
    if (!host) {
      return;
    }
    panel = document.createElement("div");
    panel.id = "mapQueuePanel";
    panel.innerHTML = biaQueueHeaderHtml() + '<div id="mapQueueList"></div>';
    if (after && after.nextSibling) {
      host.insertBefore(panel, after.nextSibling);
    } else {
      host.appendChild(panel);
    }
  } else {
    // Only rebuild the header when the admin state actually changed
    var wantAdmin = biaIsMapAdmin() ? "1" : "0";
    if (panel.getAttribute("data-admin") !== wantAdmin) {
      var head = biaById("mapQueueHeader");
      var tmp = document.createElement("div");
      tmp.innerHTML = biaQueueHeaderHtml();
      if (head && tmp.firstChild) panel.replaceChild(tmp.firstChild, head);
    }
  }
  panel.setAttribute("data-admin", biaIsMapAdmin() ? "1" : "0");
  biaEnsureFavRow();
  biaEnsureAdminTools();
}


/* biaPinVotePopup: moved to BIA core (v3) */

function biaBindTooltips(root) {

  var btns = root.querySelectorAll(".biaTipBtn");
  for (var i = 0; i < btns.length; i++) {
    (function (btn) {
      btn.addEventListener("mousemove", function (e) {
        biaTipMouseX = e.clientX;
        biaTipMouseY = e.clientY;
        var tip = document.getElementById("biaFloatTip");
        if (tip) {
          biaPlaceTip(tip, biaTipMouseX, biaTipMouseY);
        }
      });
      btn.addEventListener("mouseenter", function (e) {
        biaTipMouseX = e.clientX;
        biaTipMouseY = e.clientY;
        if (biaTipTimer) {
          clearTimeout(biaTipTimer);
        }
        biaTipTimer = setTimeout(function () {
          biaTipTimer = null;
          biaShowTip(btn, biaTipMouseX, biaTipMouseY);
        }, 1500);
      });
      btn.addEventListener("mouseleave", function () {
        if (biaTipTimer) {
          clearTimeout(biaTipTimer);
          biaTipTimer = null;
        }
        biaHideTip();
      });
    })(btns[i]);
  }
}

function biaPlaceTip(tip, clientX, clientY) {
  // body { transform: scale(1.3) } makes position:fixed resolve against body,
  // not the viewport. Convert client (viewport) coords into body's local space.
  var body = document.body;
  var br = body.getBoundingClientRect();
  var bw = body.offsetWidth || 1074;
  var bh = body.offsetHeight || 473;
  var scaleX = br.width / bw;
  var scaleY = br.height / bh;
  if (!scaleX || scaleX < 0.01) scaleX = 1;
  if (!scaleY || scaleY < 0.01) scaleY = 1;

  var pad = 12;
  var localX = (clientX - br.left) / scaleX + pad;
  var localY = (clientY - br.top) / scaleY + pad;

  tip.style.position = "absolute";
  tip.style.left = localX + "px";
  tip.style.top = localY + "px";

  var w = tip.offsetWidth || 160;
  var h = tip.offsetHeight || 40;
  if (localX + w > bw - 4) {
    tip.style.left = Math.max(4, (clientX - br.left) / scaleX - w - pad) + "px";
  }
  if (localY + h > bh - 4) {
    tip.style.top = Math.max(4, (clientY - br.top) / scaleY - h - pad) + "px";
  }
}

function biaShowTip(btn, x, y) {
  biaHideTip();
  var tip = document.createElement("div");
  tip.id = "biaFloatTip";
  tip.textContent = btn.getAttribute("data-tip") || "";
  // must be inside body (transformed containing block)
  document.body.appendChild(tip);
  biaPlaceTip(tip, x || biaTipMouseX, y || biaTipMouseY);
}

function biaHideTip() {
  var tip = document.getElementById("biaFloatTip");
  if (tip && tip.parentNode) {
    tip.parentNode.removeChild(tip);
  }
}

function biaToggleRandom() {
  biaQueueRandom = !biaQueueRandom;
  biaRenderQueue();
  biaQueueSaveSoon();
}

function biaQueueMap(mapIndex, mapName, mapMode) {
  for (var i = 0; i < biaMapQueue.length; i++) {
    if (
      biaMapQueue[i].index === mapIndex &&
      biaMapQueue[i].name === mapName &&
      biaMapQueue[i].mode === mapMode
    ) {
      var existing = biaMapQueue.splice(i, 1)[0];
      biaMapQueue.push(existing);
      biaEnsureQueuePanel();
      biaSetRotationMode("Queue");
      biaRenderQueue();
      biaQueueSaveSoon();
      return;
    }
  }
  biaMapQueue.push({ index: mapIndex, name: mapName, mode: mapMode });
  biaEnsureQueuePanel();
  biaSetRotationMode("Queue");
  biaRenderQueue();
  biaQueueSaveSoon();
}

function biaRemoveFromQueue(i) {
  biaMapQueue.splice(i, 1);
  biaRenderQueue();
  if (biaMapQueue.length === 0) {
    biaSetRotationMode("Startup");
  }
  biaQueueSaveSoon();
}

var biaMoveClick = { i: -1, dir: 0, t: 0, timer: null };
function biaMoveInQueueClick(i, dir) {
  if (!biaIsMapAdmin()) return;
  var now = Date.now();
  // Second click within 700ms on same arrow = jump top/bottom
  if (biaMoveClick.i === i && biaMoveClick.dir === dir && now - biaMoveClick.t < 700) {
    if (biaMoveClick.timer) {
      clearTimeout(biaMoveClick.timer);
      biaMoveClick.timer = null;
    }
    biaMoveClick = { i: -1, dir: 0, t: 0, timer: null };
    biaMoveInQueue(i, dir < 0 ? -999 : 999);
    return;
  }
  // Defer single-step so a double-click does not also move by 1
  if (biaMoveClick.timer) clearTimeout(biaMoveClick.timer);
  biaMoveClick = {
    i: i,
    dir: dir,
    t: now,
    timer: setTimeout(function () {
      biaMoveClick.timer = null;
      biaMoveInQueue(i, dir);
    }, 280)
  };
}
function biaMoveInQueue(i, dir) {
  if (!biaIsMapAdmin()) return;
  if (!biaMapQueue || i < 0 || i >= biaMapQueue.length) return;
  var j;
  if (dir <= -999) {
    j = 0;
  } else if (dir >= 999) {
    j = biaMapQueue.length - 1;
  } else {
    j = i + dir;
  }
  if (j < 0 || j >= biaMapQueue.length || j === i) return;
  var tmp = biaMapQueue[i];
  biaMapQueue.splice(i, 1);
  biaMapQueue.splice(j, 0, tmp);
  biaLocalDirty = true;
  biaRenderQueue();
  biaQueueSaveSoon();
}


function biaClearQueue() {
  biaMapQueue = [];
  biaLocalDirty = true;
  biaSuppressRestoreUntil = Date.now() + 8000;
  biaRenderQueue();
  biaSetRotationMode("Startup");
  biaFlushQueueSave();
}

function biaLookupModeForIndex(k) {
  var modeEl =
    document.getElementById("mapRotationFieldElement" + k + "gameMode") ||
    document.getElementById("mapListFieldElement" + k + "gameMode");
  if (!modeEl) {
    return "";
  }
  var mode = modeEl.innerText || modeEl.textContent || "";
  return mode.replace(/\s+/g, " ").trim();
}

function biaRenderQueue() {
  var toggle = biaById("mapQueueRandom");
  if (toggle) {
    if (biaQueueRandom) {
      toggle.classList.add("checked");
    } else {
      toggle.classList.remove("checked");
    }
  }
  var list = biaById("mapQueueList");
  if (!list) {
    return;
  }
  if (biaMapQueue.length === 0) {
    list.innerHTML =
      '<div id="mapQueueEmpty">' +
      (biaIsMapAdmin() ? "Click maps in the list to queue them." : "No maps queued. Use Vote to pick the next map.") +
      "</div>";
  } else {
    var admin = biaIsMapAdmin();
    var html = "";
    for (var i = 0; i < biaMapQueue.length; i++) {
      var entry = biaMapQueue[i];
      if (!entry.mode && entry.index != null) {
        entry.mode = biaLookupModeForIndex(entry.index);
      }
      html +=
        '<div class="mapQueueRow' + (i === 0 ? " mapQueueUpNext" : "") + '">' +
        '<div class="mapQueuePos">' + (i + 1) + "</div>" +
        '<div class="mapQueueName">' + entry.name + "</div>" +
        '<div class="mapQueueMode">' + (entry.mode || "") + "</div>" +
        (admin
          ? '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Move up (double-click: top)" onclick="biaMoveInQueueClick(' + i + ', -1)">&#8593;</div>' +
            '<div class="mapQueueBtn biaTipBtn biaKeepFont" data-tip="Move down (double-click: bottom)" onclick="biaMoveInQueueClick(' + i + ', 1)">&#8595;</div>' +
            '<div class="mapQueueBtn biaKeepFont" onclick="biaRemoveFromQueue(' + i + ')">X</div>'
          : '<div class="mapQueueBtn biaTipBtn" data-tip="Start a public vote for this map" onclick="biaStartMapVote(' + i + ')">Vote</div>') +
        "</div>";
    }
    list.innerHTML = html;
  }
  var panel = biaById("mapQueuePanel");
  biaBindTooltips(panel || list);
  biaAttachHints("mapQueueList", "mapQueuePanel", "right");
  biaRefreshQueueBadges();
  biaI18nSoon();
  setTimeout(biaFitScrollLists, 30);
}

function biaAdvanceQueue(currentMapIndex) {
  biaEnsureQueuePanel();
  biaLastCurrentMap = currentMapIndex;
}

function biaQueueMapByIndex(k) {
  var name = "MAP " + k;
  var mode = "";
  var nameEl =
    document.getElementById("mapRotationFieldElement" + k + "map") ||
    document.getElementById("mapListFieldElement" + k + "map");
  // ids are ...gameMode (camelCase g lower) — GameMode never matched, mode was always empty
  var modeEl =
    document.getElementById("mapRotationFieldElement" + k + "gameMode") ||
    document.getElementById("mapListFieldElement" + k + "gameMode");
  if (nameEl) {
    name = nameEl.innerHTML.replace(/<[^>]+>/g, "").trim();
  }
  if (modeEl) {
    // strip markers/spans, keep mode text only
    mode = modeEl.innerText || modeEl.textContent || "";
    mode = mode.replace(/\s+/g, " ").trim();
  }
  biaQueueMap(k, name, mode);
}

function biaSetActiveTab(id) {
  var tabs = [
    "serverInfoTab",
    "scoreboardTab",
    "settingsTab",
    "mapRotationTab",
    "serverSetupTab"
  ];
  for (var i = 0; i < tabs.length; i++) {
    var el = document.getElementById(tabs[i]);
    if (!el) {
      continue;
    }
    if (tabs[i] === id) {
      if (!el.classList.contains("active")) {
        el.classList.add("active");
      }
    } else if (el.classList.contains("active")) {
      el.classList.remove("active");
    }
  }
}

function biaSetRotationMode(mode) {
  biaRotationMode = mode;
  var el = document.getElementById("serverSetupCurrentMapRotation");
  if (el) {
    el.innerHTML = mode;
  }
}

function mapRotationPlus() {
  biaSetRotationMode(biaRotationMode === "Startup" ? "Queue" : "Startup");
}

function mapRotationMinus() {
  mapRotationPlus();
}

function manageMapRotations() {
  biaEnsureQueuePanel();
  WebUI.Call("DispatchEvent", "WebUI:GetMapQueue");
}

function biaSaveQueueNow() {
  var payload = [];
  for (var i = 0; i < biaMapQueue.length; i++) {
    payload.push({
      index: biaMapQueue[i].index,
      name: biaMapQueue[i].name,
      mode: biaMapQueue[i].mode
    });
  }
  biaLocalDirty = false;
  // suppress server MapQueue echo so it cannot clobber in-flight UI edits
  biaSuppressRestoreUntil = Date.now() + 8000;
  WebUI.Call(
    "DispatchEvent",
    "WebUI:SaveMapQueue",
    JSON.stringify({ random: biaQueueRandom, maps: payload })
  );
}

function restoreMapQueue(args) {
  // Never replace a non-empty local queue with an empty server restore mid-edit
  if (args == null || (Array.isArray(args) && args.length === 0 && biaMapQueue && biaMapQueue.length > 0 && (Date.now() < biaSuppressRestoreUntil || biaLocalDirty))) {
    return;
  }

  if (!args) {
    return;
  }
  // Ignore server echo for a few seconds after local edits/clear, otherwise
  // an empty BroadcastQueue from "clear" arrives after the player already
  // re-queued maps and wipes the UI (and blocks further adds until reload).
  if (Date.now() < biaSuppressRestoreUntil || biaLocalDirty) {
    return;
  }
  biaQueueRandom = args.random === true;
  biaMapQueue = args.maps || [];
  biaEnsureQueuePanel();
  if (biaMapQueue.length > 0) {
    biaSetRotationMode("Queue");
  } else {
    biaSetRotationMode("Startup");
  }
  biaRenderQueue();
}

function biaQueueSaveSoon() {
  biaLocalDirty = true;
  biaSuppressRestoreUntil = Date.now() + 8000;
  if (biaSaveTimer !== null) {
    clearTimeout(biaSaveTimer);
  }
  // 10s after last change — resets if another edit comes in first
  biaSaveTimer = setTimeout(function () {
    biaSaveTimer = null;
    biaSaveQueueNow();
  }, 4000);
}

function biaFlushQueueSave() {
  if (biaSaveTimer !== null) {
    clearTimeout(biaSaveTimer);
    biaSaveTimer = null;
  }
  biaSaveQueueNow();
}

function biaForceNextFromQueue() {
  biaFlushQueueSave();
  WebUI.Call("DispatchEvent", "WebUI:ForceNextFromQueue");
}

function biaAnnounceQueue() {
  WebUI.Call("DispatchEvent", "WebUI:AnnounceQueue");
}

/* --- vote for next map from queue -------------------------------------- */

function biaStartMapVoteFromList(k) {
  // k is the 1-based map list index - the same base the queue and
  // BiaManager:ApplyNextMap use (they subtract 1 for RCON). Sending k-1 here
  // made a passed vote load the map ABOVE the one voted for.
  var mapEl = biaById("mapRotationFieldElement" + k + "map");
  var name = mapEl ? (mapEl.textContent || "").trim() : "Map";
  var mode = biaLookupModeForIndex(k);
  if (biaMapVoteActive || isVoteInProgress) {
    showPopupResponse(["Vote in progress.", "Finish the current vote before starting another."]);
    return;
  }
  WebUI.Call(
    "DispatchEvent",
    "WebUI:StartMapVote",
    JSON.stringify({ index: k, name: name, mode: mode, fromList: true })
  );
}

function biaInstaVoteFromList(k) {
  // Anyone may insta-load; the server enforces a cooldown for non-admins.
  // Server does setNextMapIndex(k-1) + runNextRound atomically. The old path
  // sent k-1 to SetNextMap, which subtracts 1 again -> wrong map.
  if (biaIsMapAdmin()) biaFlushQueueSave();
  var mapEl = biaById("mapRotationFieldElement" + k + "map");
  var name = mapEl ? (mapEl.textContent || "").trim() : "";
  var mode = biaLookupModeForIndex(k);
  WebUI.Call("DispatchEvent", "WebUI:BiaInstaMap", JSON.stringify({ index: k, name: name, mode: mode }));
}

function biaStartMapVote(i) {
  if (i < 0 || i >= biaMapQueue.length) {
    return;
  }
  if (biaMapVoteActive || isVoteInProgress) {
    showPopupResponse([
      "Vote in progress.",
      "Finish the current vote before starting another."
    ]);
    return;
  }
  var entry = biaMapQueue[i];
  WebUI.Call(
    "DispatchEvent",
    "WebUI:StartMapVote",
    JSON.stringify({
      index: entry.index,
      name: entry.name,
      mode: entry.mode || ""
    })
  );
}

var biaMapVoteTimer = null;


var biaMarqueeTimer = null;

function biaStopVoteMarquee() {
  if (biaMarqueeTimer !== null) {
    clearInterval(biaMarqueeTimer);
    biaMarqueeTimer = null;
  }
}

function biaStartVoteMarquee() {
  biaStopVoteMarquee();
  var wrap = document.getElementById("votetitleleft");
  if (!wrap) return;
  var inner = wrap.querySelector(".biaMarqueeInner");
  if (!inner) return;
  inner.style.marginLeft = "0px";
  // Gameface often ignores CSS @keyframes — scroll with JS instead
  var need = inner.scrollWidth - wrap.clientWidth;
  if (need <= 8) {
    return;
  }
  var pos = 0;
  var pause = 40; // frames to wait at start/end (~2s at 50ms)
  var phase = "pauseStart"; // pauseStart -> scroll -> pauseEnd -> reset
  biaMarqueeTimer = setInterval(function () {
    if (!biaMapVoteActive) {
      biaStopVoteMarquee();
      return;
    }
    if (phase === "pauseStart" || phase === "pauseEnd") {
      pause -= 1;
      if (pause <= 0) {
        if (phase === "pauseStart") {
          phase = "scroll";
        } else {
          pos = 0;
          inner.style.marginLeft = "0px";
          phase = "pauseStart";
          pause = 40;
        }
      }
      return;
    }
    pos -= 1;
    if (pos <= -need) {
      pos = -need;
      inner.style.marginLeft = pos + "px";
      phase = "pauseEnd";
      pause = 50;
      return;
    }
    inner.style.marginLeft = pos + "px";
  }, 40);
}




function startMapVote(args) {
  if (!args) {
    return;
  }
  if (biaPreviewTimer) {
    clearTimeout(biaPreviewTimer);
    biaPreviewTimer = null;
  }
  if (biaVoteResultTimer) {
    clearTimeout(biaVoteResultTimer);
    biaVoteResultTimer = null;
  }
  biaMapVoteActive = true;
  isVoteInProgress = true;
  secondsLeft = args.seconds || 30;
  yesvotes = args.yes || 1;
  novotes = args.no || 0;
  biaVoteNeeded = args.needed || 0;
  showHideVotings = true;
  var label = args.name || "Map";
  if (args.mode) {
    label = label + " (" + args.mode + ")";
  }
  biaById("votepopup").classList.add("shown");
  biaById("votetitleleft").innerHTML =
    '<p class="biaMarquee"><span class="biaMarqueeInner">Next map: ' + label + "</span></p>";
  biaById("votetitleleft").style.width = "80%";
  biaById("votetitleright").innerHTML = "<p>" + secondsLeft + " sec</p>";
  setTimeout(biaStartVoteMarquee, 50);
  biaById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  biaById("countnovotes").innerHTML = "" + novotes + " N";
  biaById("voteyes").style.fontWeight = "900";
  biaById("voteno").style.fontWeight = null;
  biaById("voteyes").onclick = function () {
    if (biaMapVoteActive) biaMapVoteYes();
  };
  biaById("voteno").onclick = function () {
    if (biaMapVoteActive) biaMapVoteNo();
  };
  biaUpdateVoteBar();
  biaPositionVotePopup();
  biaEnforceTabs();
  if (biaMapVoteTimer !== null) {
    clearInterval(biaMapVoteTimer);
  }
  biaMapVoteTimer = setInterval(function () {
    if (!biaMapVoteActive) {
      clearInterval(biaMapVoteTimer);
      biaMapVoteTimer = null;
      return;
    }
    secondsLeft = Math.max(0, secondsLeft - 1);
    biaById("votetitleright").innerHTML = "<p>" + secondsLeft + " sec</p>";
    if (secondsLeft <= 0) {
      clearInterval(biaMapVoteTimer);
      biaMapVoteTimer = null;
      // Safety: if server MapVoteEnd was lost (e.g. mid round-start), close UI
      setTimeout(function () {
        if (biaMapVoteActive) {
          endMapVote({ success: false, cancelled: true });
        }
      }, 1500);
    }
  }, 1000);
}

function updateMapVote(args) {
  if (!args) {
    return;
  }
  yesvotes = args.yes || 0;
  novotes = args.no || 0;
  if (args.needed) biaVoteNeeded = args.needed;
  if (showHideVotings == true) {
    biaById("countyesvotes").innerHTML = "" + yesvotes + " Y";
    biaById("countnovotes").innerHTML = "" + novotes + " N";
  }
  biaUpdateVoteBar();
}

function endMapVote(args) {
  args = args || {};
  biaMapVoteActive = false;
  isVoteInProgress = false;
  biaStopVoteMarquee();
  if (biaMapVoteTimer !== null) {
    clearInterval(biaMapVoteTimer);
    biaMapVoteTimer = null;
  }
  var popup = biaById("votepopup");
  var yes = biaById("voteyes");
  var no = biaById("voteno");
  var left = biaById("votetitleleft");
  if (yes) {
    yes.style.fontWeight = null;
    yes.onclick = null;
  }
  if (no) {
    no.style.fontWeight = null;
    no.onclick = null;
  }
  biaVoteNeeded = 0;
  biaUpdateVoteBar();
  biaEnforceTabs();
  // Show the result for a few seconds instead of vanishing (a vote that
  // passes instantly - e.g. you + bots only - used to flash for ~1s).
  var verdict = args.cancelled ? "Vote cancelled" : args.success ? "Vote passed" : "Vote failed";
  if (popup && left && popup.classList.contains("shown")) {
    left.innerHTML = "<p>" + verdict + (args.name ? ": " + args.name : "") + "</p>";
    biaById("votetitleright").innerHTML = "<p></p>";
    if (biaVoteResultTimer) clearTimeout(biaVoteResultTimer);
    biaVoteResultTimer = setTimeout(function () {
      biaVoteResultTimer = null;
      if (!isVoteInProgress && !biaMapVoteActive) {
        popup.classList.remove("shown");
        left.style.width = null;
      }
    }, 3000);
  } else if (popup) {
    popup.classList.remove("shown");
    if (left) left.style.width = null;
  }
}

/* Hook existing F8/F9 vote handlers when a map vote is active.
   The original client already binds keys to WebUI events; we also expose
   these for the yes/no rows if clicked. */
function biaMapVoteYes() {
  if (!biaMapVoteActive) {
    return;
  }
  WebUI.Call("DispatchEvent", "WebUI:MapVoteYes");
  document.getElementById("voteyes").style.fontWeight = "900";
  document.getElementById("voteno").style.fontWeight = null;
}

function biaMapVoteNo() {
  if (!biaMapVoteActive) {
    return;
  }
  WebUI.Call("DispatchEvent", "WebUI:MapVoteNo");
  document.getElementById("voteno").style.fontWeight = "900";
  document.getElementById("voteyes").style.fontWeight = null;
}

/* Patch voteYes/voteNo only for map votes — keep original counter for kick/ban.
   Original voteYes just increments local UI; server drives map vote counts. */
var _biaOrigVoteYes = typeof voteYes === "function" ? voteYes : null;
var _biaOrigVoteNo = typeof voteNo === "function" ? voteNo : null;

voteYes = function () {
  if (biaMapVoteActive) {
    biaMapVoteYes();
    return;
  }
  if (_biaOrigVoteYes) {
    _biaOrigVoteYes();
  }
};

voteNo = function () {
  if (biaMapVoteActive) {
    biaMapVoteNo();
    return;
  }
  if (_biaOrigVoteNo) {
    _biaOrigVoteNo();
  }
};

/* --- ban / admin manager ------------------------------------------------ */
function biaEnsureListPanel() {
  if (biaById("biaListPanel")) {
    return;
  }
  var panel = document.createElement("div");
  panel.id = "biaListPanel";
  panel.innerHTML =
    '<div id="biaListHeader">Manage Lists' +
    '<div class="biaListBtn" style="margin-left:auto" onclick="biaCloseLists()">X</div>' +
    "</div>" +
    '<div id="biaListTabs">' +
    '<div class="biaListTab active" id="biaTabBans" onclick="biaShowLists(\'bans\')">Ban List</div>' +
    '<div class="biaListTab" id="biaTabAdmins" onclick="biaShowLists(\'admins\')">Admin List</div>' +
    '<div class="biaListTab" id="biaTabLog" onclick="biaShowLists(\'log\')">Admin Log</div>' +
    "</div>" +
    '<div id="biaListBody"></div>';
  document.body.appendChild(panel);
}

function biaShowLists(mode) {
  biaEnsureListPanel();
  biaListMode = mode || biaListMode;
  biaById("biaListPanel").classList.add("open");
  var tabs = { bans: "biaTabBans", admins: "biaTabAdmins", log: "biaTabLog" };
  for (var key in tabs) {
    var el = biaById(tabs[key]);
    if (!el) continue;
    if (key === biaListMode) el.classList.add("active");
    else el.classList.remove("active");
  }
  if (biaListMode === "bans") {
    WebUI.Call("DispatchEvent", "WebUI:GetBanList");
  } else if (biaListMode === "admins") {
    WebUI.Call("DispatchEvent", "WebUI:GetAdminList");
  } else {
    WebUI.Call("DispatchEvent", "WebUI:BiaGetAdminLog");
  }
  biaRenderList();
}

function biaCloseLists() {
  var panel = document.getElementById("biaListPanel");
  if (panel) {
    panel.classList.remove("open");
  }
}

function getBanList(args) {
  biaBanList = args || [];
  if (biaListMode === "bans") {
    biaRenderList();
  }
}

function getAdminList(args) {
  biaAdminList = args || [];
  if (biaListMode === "admins") {
    biaRenderList();
  }
}

function biaUnban(name) {
  WebUI.Call("DispatchEvent", "WebUI:UnbanPlayer", name);
  if (Array.isArray(biaBanList)) {
    biaBanList = biaBanList.filter(function (a) {
      var n = typeof a === "string" ? a : a && (a.name || a[0]);
      return n !== name;
    });
    biaRenderList();
  }
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetBanList"); }, 400);
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetBanList"); }, 1600);
}

function biaRemoveAdmin(name) {
  WebUI.Call("DispatchEvent", "WebUI:RemoveAdmin", name);
  if (Array.isArray(biaAdminList)) {
    biaAdminList = biaAdminList.filter(function (a) {
      var n = typeof a === "string" ? a : a && (a.name || a[0]);
      return n !== name;
    });
    biaRenderList();
  }
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetAdminList"); }, 400);
  setTimeout(function () { WebUI.Call("DispatchEvent", "WebUI:GetAdminList"); }, 1600);
}

function promoteToAdmin(name) {
  if (biaIsBot(name)) {
    showPopupResponse([
      "That is a bot.",
      name + " is an AI player and cannot be promoted to admin."
    ]);
    return;
  }
  biaAddAdminFromScoreboard(name);
}

function biaAddAdminFromScoreboard(name) {
  WebUI.Call("DispatchEvent", "WebUI:AddAdmin", name);
}

function biaRenderList() {
  var body = biaById("biaListBody");
  if (!body) {
    return;
  }
  if (biaListMode === "log") {
    if (!biaAdminLog || biaAdminLog.length === 0) {
      body.innerHTML = '<div class="biaListEmpty">No admin actions logged yet.</div>';
      return;
    }
    var lh = "";
    for (var l = 0; l < biaAdminLog.length; l++) {
      var e = biaAdminLog[l] || {};
      lh +=
        '<div class="biaListRow biaLogRow">' +
        '<div class="biaLogTime">' + biaEsc(e.t || "") + "</div>" +
        '<div class="biaLogText">' + biaEsc(e.text || "") + "</div>" +
        "</div>";
    }
    body.innerHTML = lh;
    return;
  }
  var rows = biaListMode === "bans" ? biaBanList : biaAdminList;
  if (!rows || rows.length === 0) {
    body.innerHTML =
      '<div class="biaListEmpty">' +
      (biaListMode === "bans" ? "No banned players." : "No admins set.") +
      "</div>";
    return;
  }
  var html = "";
  for (var i = 0; i < rows.length; i++) {
    var entry = rows[i];
    var name = entry.name || entry;
    var meta = entry.reason || entry.rights || "";
    var safeName = String(name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    var action =
      biaListMode === "bans"
        ? '<div class="biaListBtn" onclick="biaUnban(\'' + safeName + '\')">Unban</div>'
        : '<div class="biaListBtn" onclick="biaRemoveAdmin(\'' + safeName + '\')">Remove</div>';
    html +=
      '<div class="biaListRow">' +
      '<div class="biaListName">' + biaEsc(name) + "</div>" +
      '<div class="biaListMeta">' + biaEsc(meta) + "</div>" +
      action +
      "</div>";
  }
  body.innerHTML = html;
}

function biaIsBot(name) {
  return typeof name === "string" && name.indexOf("BOT_") === 0;
}

function biaRefuseBot(name) {
  showPopupResponse([
    "That is a bot.",
    name + " is an AI player and cannot be banned or kicked from the ban list."
  ]);
}


/* Restore FOV/sens from this PC when WebUI boots (incl. after level reload) */
(function biaBootLookLocal() {
  function run() {
    try {
      biaApplyLookLocalToGame();
    } catch (e) {}
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(run, 1500);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(run, 1500);
    });
  }
})();


function biaUpdateScrollHints() {
  biaRefreshAllHints();
}

/* ==========================================================================
   Scoreboard rendering (v3)
   Each table is:  .sbTable > [.sbHead (team banner + K/D/SCORE/PING),
                               .sbBody (rows, THIS scrolls),
                               hint arrows]
   so the red/blue banners and column names never scroll away.
   Rows are buffered and written once per table per update instead of one
   innerHTML += per player (that re-parsed the whole table every row: O(n^2)).
   Scroll position survives the periodic refresh.
   ========================================================================== */
var biaSbBuf = {};
var biaSbFlushTimer = null;
var biaSbSavedScroll = {};

function biaSbShell(n, team, tickets) {
  return (
    '<div class="sbHead" id="table' + n + 'head">' +
    '<div class="sbRow" id="firstrow">' +
    '<div class="sbCell" id="team' + n + '">' + team + "</div>" +
    '<div class="sbCell" id="tickets' + n + '">' + tickets + "</div>" +
    '<div class="sbCell" id="killsHeader' + n + '">K</div>' +
    '<div class="sbCell" id="deathsHeader' + n + '">D</div>' +
    '<div class="sbCell" id="scoreHeader' + n + '">SCORE</div>' +
    '<div class="sbCell" id="pingHeader' + n + '">PING</div>' +
    "</div></div>" +
    '<div class="sbBody" id="table' + n + 'tbody"></div>'
  );
}
function biaSbReset(n, team, tickets) {
  var t = biaById("table" + n);
  if (!t) return;
  var body = biaById("table" + n + "tbody");
  if (body && body.scrollTop > 0) {
    biaSbSavedScroll["table" + n + "tbody"] = body.scrollTop;
  }
  biaSbBuf["table" + n + "tbody"] = [];
  t.innerHTML = biaSbShell(n, team, tickets);
  biaAttachHints("table" + n + "tbody", "table" + n, n % 2 === 1 ? "left" : "right");
}
function biaSbAppend(id, html) {
  if (!biaSbBuf[id]) biaSbBuf[id] = [];
  biaSbBuf[id].push(html);
  if (biaSbFlushTimer === null) {
    biaSbFlushTimer = setTimeout(biaSbFlush, 0);
  }
}
function biaSbFlush() {
  if (biaSbFlushTimer !== null) {
    clearTimeout(biaSbFlushTimer);
    biaSbFlushTimer = null;
  }
  for (var id in biaSbBuf) {
    if (!biaSbBuf.hasOwnProperty(id)) continue;
    var arr = biaSbBuf[id];
    if (!arr || arr.length === 0) continue;
    var el = biaById(id);
    if (el) el.innerHTML += arr.join("");
    biaSbBuf[id] = [];
  }
  biaSbAfterRender(false);
}
function biaSbSizeBodies() {
  if (biaSquadMode) {
    biaSquadLayout();
    return;
  }
  for (var n = 1; n <= 4; n++) {
    var t = biaById("table" + n);
    var h = biaById("table" + n + "head");
    var b = biaById("table" + n + "tbody");
    if (!t || !h || !b) continue;
    var th = t.clientHeight;
    if (th > 60) {
      b.style.height = Math.max(28, th - (h.offsetHeight || 30)) + "px";
    }
  }
}
function biaSbAfterRender(final) {
  biaApplyPin();
  biaSbSizeBodies();
  for (var id in biaSbSavedScroll) {
    if (!biaSbSavedScroll.hasOwnProperty(id)) continue;
    var b = biaById(id);
    if (b) b.scrollTop = biaSbSavedScroll[id];
    if (final) delete biaSbSavedScroll[id];
  }
  biaRefreshAllHints();
}
function biaSbEmptyRows(n, count) {
  var one =
    '<div id="empty" class="sbRow"><div class="sbCell" id="place' + n + '"></div><div class="sbCell" id="name' + n +
    '"></div><div class="sbCell" id="kills' + n + '"></div><div class="sbCell" id="deaths' + n +
    '"></div><div class="sbCell" id="points' + n + '"></div><div class="sbCell" id="ping' + n + '"></div></div>';
  var s = "";
  for (var i = 0; i < count; i++) s += one;
  return s;
}

/* --- squad deathmatch: explicit 2x2 grid ---------------------------------
   Gameface doesn't wrap the table row reliably (tables 3/4 were drawn over
   1/2), so squad mode places the four tables absolutely:
     [ squad 1 ][ squad 2 ]   6 rows visible, the rest scrolls
     [ squad 3 ][ squad 4 ]   8 rows visible, the rest scrolls
   Works for any squad size (a squad-size mod just means more scrolling). */
var biaSquadMode = false;
var BIA_SQUAD_TOP_ROWS = 6;
var BIA_SQUAD_BOTTOM_ROWS = 8;
var BIA_SQUAD_GAP = 8;
function biaSquadRowH(n) {
  var b = biaById("table" + n + "tbody");
  var r = b && b.firstElementChild;
  return (r && r.offsetHeight) || 28;
}
function biaSquadLayout() {
  var tables = biaById("tables");
  if (!tables) return;
  tables.classList.add("biaSquadMode");
  var t = [null, biaById("table1"), biaById("table2"), biaById("table3"), biaById("table4")];
  if (!t[1] || !t[2] || !t[3] || !t[4]) return;
  var rowsFor = [0, BIA_SQUAD_TOP_ROWS, BIA_SQUAD_TOP_ROWS, BIA_SQUAD_BOTTOM_ROWS, BIA_SQUAD_BOTTOM_ROWS];
  var setH = [0, 0, 0, 0, 0];
  for (var n = 1; n <= 4; n++) {
    var head = biaById("table" + n + "head");
    var body = biaById("table" + n + "tbody");
    var hh = (head && head.offsetHeight) || 30;
    var bh = rowsFor[n] * biaSquadRowH(n);
    if (body) body.style.height = bh + "px";
    setH[n] = hh + bh;
    t[n].style.height = setH[n] + "px";
    t[n].style.position = "absolute";
    t[n].style.marginTop = "0px";
  }
  var w = t[1].offsetWidth || 556;
  // offsetHeight includes the table padding; fall back to the heights we set
  var topH = Math.max(t[1].offsetHeight, t[2].offsetHeight, setH[1], setH[2]);
  var y2 = topH + BIA_SQUAD_GAP;
  t[1].style.left = "0px";
  t[1].style.top = "0px";
  t[2].style.left = w + 2 + "px";
  t[2].style.top = "0px";
  t[3].style.left = "0px";
  t[3].style.top = y2 + "px";
  t[4].style.left = w + 2 + "px";
  t[4].style.top = y2 + "px";
  tables.style.height = y2 + Math.max(t[3].offsetHeight, t[4].offsetHeight, setH[3], setH[4]) + "px";
  tables.style.marginTop = "30px";
}
function biaSquadLayoutOff() {
  biaSquadMode = false;
  var tables = biaById("tables");
  if (tables) {
    tables.classList.remove("biaSquadMode");
    tables.style.height = "";
    tables.style.marginTop = "";
  }
  for (var n = 1; n <= 4; n++) {
    var t = biaById("table" + n);
    if (!t) continue;
    t.style.position = "";
    t.style.left = "";
    t.style.top = "";
    t.style.height = "";
    t.style.marginTop = "";
    if (n > 2) t.style.display = "none";
  }
}

var biaVoteResultTimer = null;

var biaVoteNeeded = 0;

function biaUpdateVoteBar() {
  var pop = biaById("votepopup");
  if (!pop) return;
  var bar = biaById("biaVoteBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "biaVoteBar";
    bar.innerHTML = '<div id="biaVoteBarFill"></div><div id="biaVoteBarText"></div>';
    pop.appendChild(bar);
  }
  if (!biaMapVoteActive || !biaVoteNeeded) {
    bar.style.display = "none";
    return;
  }
  var pct = biaClamp(Math.round((yesvotes / biaVoteNeeded) * 100), 0, 100);
  bar.style.display = "flex";
  biaById("biaVoteBarFill").style.width = pct + "%";
  biaById("biaVoteBarText").textContent = yesvotes + " / " + biaVoteNeeded + " needed";
}

/* ==========================================================================
   Map lists (v3) - ONE builder for Server Info + Map Rotation.
   Before, getServerInfo and getCurrentMapRotation each had their own copy of
   the loop, and only one of them added Vote/Insta buttons, so the buttons
   vanished whenever the rotation was re-broadcast (level load, queue save).
   Also: HTML is built as one string and written once (was innerHTML += per
   cell), and words-per-map comes from the RCON reply instead of assuming 3.
   ========================================================================== */
var biaMapListCache = null;
var biaModeFilter = "";
var BIA_ROTATION_TAB_FOR_ALL = true; // everyone can open Map Rotation to vote; admin bits stay admin-only

function biaQueuePosOf(k) {
  for (var i = 0; i < biaMapQueue.length; i++) {
    if (Number(biaMapQueue[i].index) === k) return i + 1;
  }
  return 0;
}
function biaMarkers(isCur, isNext, suffix) {
  return (
    (isCur ? '<div class="mapMarker current" id="currentMap' + suffix + '"></div>' : "") +
    (isNext ? '<div class="mapMarker next" id="nextMap' + suffix + '"></div>' : "")
  );
}
function biaBuildMapLists(list, currentMapIndex, nextMapIndex) {
  if (!list || typeof list === "string" || list.length < 2) {
    return;
  }
  biaMapListCache = { list: list, cur: currentMapIndex, next: nextMapIndex };
  var count = parseInt(list[0], 10) || 0;
  var wpm = parseInt(list[1], 10) || 3;
  var cur = parseInt(currentMapIndex, 10);
  var nxt = parseInt(nextMapIndex, 10);
  var admin = biaIsMapAdmin();
  var rot = [];
  var info = [];
  var modes = {};
  var modeOrder = [];
  for (var m = 0; m < count; m++) {
    var base = 2 + m * wpm;
    var rawMap = list[base];
    var rawMode = list[base + 1];
    if (rawMap == null) break;
    var k = m + 1;
    var map = generateMapName(rawMap);
    var mode = generateModeName(rawMode);
    var isCur = m === cur;
    var isNext = m === nxt;
    if (!modes[mode]) {
      modes[mode] = true;
      modeOrder.push(mode);
    }
    if (isCur) {
      biaById("mapRotationCurrentMap").innerHTML = map + ", " + mode;
      biaById("serverInfoMapBody").innerHTML = map;
      biaById("serverInfoMapImg").style.backgroundImage = "url(fb://" + generateMapUrl(rawMap) + ")";
      biaById("serverInfoMapRotationBody").innerHTML =
        '<p id="checkModeName"><span class="textMove">' + mode + "</span></p>";
      biaById("serverInfoModeBody").innerHTML = mode;
      biaById("serverInfoModeImg").style.backgroundImage = "url(fb://" + generateModeUrl(rawMode) + ")";
    }
    if (isNext) {
      biaById("mapRotationNextMap").innerHTML = map + ", " + mode;
    }
    var qpos = biaQueuePosOf(k);
    var hidden = biaModeFilter && biaModeFilter !== mode;
    rot.push(
      '<div onclick="biaMapRowClick(' + k + ')" class="mapRotationFieldElement' +
        (admin ? " biaRowAdmin" : "") + (qpos ? " biaRowQueued" : "") + '" id="mapRotationFieldElement' + k +
        '" data-mode="' + biaEsc(mode) + '"' + (hidden ? ' style="display:none"' : "") + ">" +
        '<div class="mapRotationFieldElementMap" id="mapRotationFieldElement' + k + 'map">' + map + "</div>" +
        '<div class="biaQBadge" id="biaQBadge' + k + '">' + (qpos ? "Q" + qpos : "") + "</div>" +
        '<div class="mapRotationFieldElementGameMode" id="mapRotationFieldElement' + k + 'gameMode"><span>' + mode + "</span>" +
        biaMarkers(isCur, isNext, "2") + "</div>" +
        '<div class="mapRotVoteBtns">' +
        '<div class="mapQueueBtn biaTipBtn mapVoteBtn" data-tip="Start a public vote for this map as next" onclick="event.stopPropagation();biaStartMapVoteFromList(' + k + ')">Vote</div>' +
        '<div class="mapQueueBtn biaTipBtn mapInstaVoteBtn" data-tip="Instavote: load this map right now" onclick="event.stopPropagation();biaInstaVoteFromList(' + k + ')">Insta</div>' +
        "</div></div>"
    );
    info.push(
      '<div class="mapListFieldElement" id="mapListFieldElement' + k + '">' +
        '<div class="mapListFieldElementMap" id="mapListFieldElement' + k + 'map">' + map + "</div>" +
        '<div class="mapListFieldElementGameMode" id="mapListFieldElement' + k + 'gameMode"><span>' + mode + "</span>" +
        biaMarkers(isCur, isNext, "") + "</div></div>"
    );
  }
  var rc = biaById("mapRotationConfiguration");
  var lc = biaById("mapListConfiguration");
  if (rc) {
    var st = rc.scrollTop;
    rc.innerHTML = rot.join("");
    rc.scrollTop = st;
  }
  if (lc) lc.innerHTML = info.join("");
  biaRenderModeFilter(modeOrder);
  biaEnsureRotationChrome();
  setTimeout(function () {
    var el = biaById("mapRotationConfiguration");
    if (el) biaBindTooltips(el);
    biaAttachHints("mapRotationConfiguration", "biaRotLeftHost", "left");
    biaAttachHints("mapListConfiguration", "biaMapListHost", "right");
    biaFitScrollLists();
  }, 40);
}
function biaRebuildMapListsFromCache() {
  if (biaMapListCache) {
    biaBuildMapLists(biaMapListCache.list, biaMapListCache.cur, biaMapListCache.next);
  }
}
/* queue badges only - cheap, no rebuild */
function biaRefreshQueueBadges() {
  if (!biaMapListCache) return;
  var count = parseInt(biaMapListCache.list[0], 10) || 0;
  for (var k = 1; k <= count; k++) {
    var b = biaById("biaQBadge" + k);
    var row = biaById("mapRotationFieldElement" + k);
    if (!b || !row) continue;
    var q = biaQueuePosOf(k);
    b.innerHTML = q ? "Q" + q : "";
    if (q) row.classList.add("biaRowQueued");
    else row.classList.remove("biaRowQueued");
  }
}
function biaMapRowClick(k) {
  if (!biaIsMapAdmin()) {
    return; // players use the Vote button
  }
  biaQueueMapByIndex(k);
}

/* hosts for scroll arrows (positioned wrappers around the scrolling lists) */
function biaEnsureRotationChrome() {
  var rc = biaById("mapRotationConfiguration");
  if (rc && rc.parentNode && rc.parentNode.id !== "biaRotLeftHost") {
    var host = document.createElement("div");
    host.id = "biaRotLeftHost";
    host.className = "biaHintHost";
    rc.parentNode.insertBefore(host, rc);
    host.appendChild(rc);
  }
  var lc = biaById("mapListConfiguration");
  if (lc && lc.parentNode && lc.parentNode.id !== "biaMapListHost") {
    var host2 = document.createElement("div");
    host2.id = "biaMapListHost";
    host2.className = "biaHintHost";
    lc.parentNode.insertBefore(host2, lc);
    host2.appendChild(lc);
  }
  biaEnsureAdminTools();
}

/* --- mode filter chips ----------------------------------------------------- */
function biaRenderModeFilter(modeOrder) {
  var bar = biaById("biaModeFilter");
  if (!bar) {
    var rc = biaById("mapRotationConfiguration");
    var anchor = biaById("biaRotLeftHost") || rc;
    if (!anchor || !anchor.parentNode) return;
    bar = document.createElement("div");
    bar.id = "biaModeFilter";
    anchor.parentNode.insertBefore(bar, anchor);
  }
  if (!modeOrder || modeOrder.length < 2) {
    bar.style.display = "none";
    biaModeFilter = "";
    return;
  }
  var found = false;
  for (var i = 0; i < modeOrder.length; i++) if (modeOrder[i] === biaModeFilter) found = true;
  if (!found) biaModeFilter = "";
  var html =
    '<div class="biaChip' + (biaModeFilter === "" ? " active" : "") + '" onclick="biaSetModeFilter(\'\')">All</div>';
  for (var j = 0; j < modeOrder.length; j++) {
    var m = modeOrder[j];
    html +=
      '<div class="biaChip' + (biaModeFilter === m ? " active" : "") + '" data-mode="' + biaEsc(m) +
      '" onclick="biaSetModeFilter(this.getAttribute(\'data-mode\'))">' + m + "</div>";
  }
  bar.innerHTML = html;
  bar.style.display = "flex";
}
function biaSetModeFilter(mode) {
  biaModeFilter = mode || "";
  var rc = biaById("mapRotationConfiguration");
  if (rc) {
    var rows = rc.children;
    for (var i = 0; i < rows.length; i++) {
      var m = rows[i].getAttribute("data-mode") || "";
      rows[i].style.display = !biaModeFilter || m === biaModeFilter ? "flex" : "none";
    }
    rc.scrollTop = 0;
  }
  var chips = document.getElementsByClassName("biaChip");
  for (var c = 0; c < chips.length; c++) {
    var cm = chips[c].getAttribute("data-mode") || "";
    if (cm === biaModeFilter) chips[c].classList.add("active");
    else chips[c].classList.remove("active");
  }
  biaRefreshAllHints();
}

/* --- queue extras ---------------------------------------------------------- */
function biaQueueAllMaps() {
  if (!biaIsMapAdmin() || !biaMapListCache) return;
  var count = parseInt(biaMapListCache.list[0], 10) || 0;
  for (var k = 1; k <= count; k++) {
    if (biaQueuePosOf(k) > 0) continue;
    var row = biaById("mapRotationFieldElement" + k);
    if (biaModeFilter && row && row.getAttribute("data-mode") !== biaModeFilter) continue;
    var nameEl = biaById("mapRotationFieldElement" + k + "map");
    var name = nameEl ? (nameEl.textContent || "").trim() : "MAP " + k;
    biaMapQueue.push({ index: k, name: name, mode: biaLookupModeForIndex(k) });
  }
  biaSetRotationMode(biaMapQueue.length ? "Queue" : "Startup");
  biaRenderQueue();
  biaQueueSaveSoon();
}
function biaShuffleQueue() {
  if (!biaIsMapAdmin() || biaMapQueue.length < 2) return;
  for (var i = biaMapQueue.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = biaMapQueue[i];
    biaMapQueue[i] = biaMapQueue[j];
    biaMapQueue[j] = t;
  }
  biaRenderQueue();
  biaQueueSaveSoon();
}

/* --- admin tools row (map rotation, right column) ------------------------- */
function biaEnsureAdminTools() {
  if (biaById("biaAdminTools")) {
    biaEnforceTabs();
    return;
  }
  var panel = biaById("mapQueuePanel");
  if (!panel || !panel.parentNode) return; // placed right under the queue once it exists
  var host = panel.parentNode;
  var tools = document.createElement("div");
  tools.id = "biaAdminTools";
  tools.className = "biaAdminOnly";
  tools.innerHTML =
    '<div class="biaToolRow">' +
    '<input id="biaSayInput" type="text" maxlength="120" placeholder="Message to all players..." data-bia-enter="biaSaySend" />' +
    '<div class="mapQueueBtn wide biaTipBtn" data-tip="Chat message to everyone (Enter also sends)" onclick="biaSaySend()">Say</div>' +
    '<div class="mapQueueBtn wide biaTipBtn" data-tip="Big yell message on everyone\'s screen (8s)" onclick="biaSaySend(true)">Yell</div>' +
    '<div class="mapQueueBtn wide biaTipBtn biaBigBtn" data-tip="Huge flashing message across everyone\'s screen (6s)" onclick="biaSaySend(\'big\')">BIG</div>' +
    "</div>" +
    '<div class="biaToolRow">' +
    '<div class="mapQueueBtn wide biaTipBtn" data-tip="Re-read Admin/maplist.txt on the server (use after editing the file)" onclick="biaReloadMapList()">Reload maplist.txt</div>' +
    '<div class="mapQueueBtn wide biaTipBtn" data-tip="Refresh the map list from the server" onclick="biaRequestMapRotation(true)">Refresh</div>' +
    '<div id="biaCancelVoteBtn" class="mapQueueBtn wide biaTipBtn" data-tip="Cancel the running map vote" onclick="biaCancelMapVote()">Cancel vote</div>' +
    "</div>" +
    '<div class="biaToolRow">' +
    '<div class="biaToolLabel biaTipBtn" data-tip="Seconds from round end until the next map loads (Off = game default, about 60s)">Round end wait</div>' +
    '<div class="mapQueueBtn biaTipBtn" data-tip="Shorter" onmousedown="biaHold(event, biaRoundEndStep, -1)">-</div>' +
    '<div id="biaRoundEndVal">Off</div>' +
    '<div class="mapQueueBtn biaTipBtn" data-tip="Longer" onmousedown="biaHold(event, biaRoundEndStep, 1)">+</div>' +
    "</div>";
  if (panel && panel.nextSibling) host.insertBefore(tools, panel.nextSibling);
  else host.appendChild(tools);
  biaBindTooltips(tools);
  biaEnforceTabs();
  try {
    WebUI.Call("DispatchEvent", "WebUI:BiaGetRoundEnd");
  } catch (e) {}
}
function biaSaySend(yell) {
  var inp = biaById("biaSayInput");
  if (!inp) return;
  var text = (inp.value || "").replace(/\s+/g, " ").trim();
  if (!text) return;
  WebUI.Call("DispatchEvent", "WebUI:BiaSay", JSON.stringify({ text: text, yell: yell === "big" ? "big" : yell === true }));
  inp.value = "";
}
function biaReloadMapList() {
  WebUI.Call("DispatchEvent", "WebUI:BiaReloadMapList");
}
function biaCancelMapVote() {
  WebUI.Call("DispatchEvent", "WebUI:BiaCancelMapVote");
}
var biaLastRotationRequest = 0;
function biaRequestMapRotation(force) {
  var now = Date.now();
  if (!force && now - biaLastRotationRequest < 5000) return;
  biaLastRotationRequest = now;
  try {
    WebUI.Call("DispatchEvent", "WebUI:BiaGetMapRotation");
  } catch (e) {}
}

/* --- tab / admin-only visibility (single owner of these display values) --- */
function biaCanSeeSetup() {
  return isOwner === true || canAlterServerSettings === true || canEditMapList === true;
}
function biaEnforceTabs() {
  var setup = biaCanSeeSetup();
  var mapAdmin = biaIsMapAdmin();
  var ssTab = biaById("serverSetupTab");
  if (ssTab) ssTab.style.display = setup ? "flex" : "none";
  var ssBtn = biaById("serverSetup");
  if (ssBtn) ssBtn.style.display = setup ? "flex" : "none";
  var ssPanel = biaById("serverSetupSettings");
  if (!setup && ssPanel && ssPanel.style.display === "flex") ssPanel.style.display = "none";
  var rotAllowed = BIA_ROTATION_TAB_FOR_ALL || mapAdmin;
  var mrTab = biaById("mapRotationTab");
  if (mrTab) mrTab.style.display = rotAllowed ? "flex" : "none";
  var mrBtn = biaById("mapRotationSetup");
  if (mrBtn) mrBtn.style.display = rotAllowed ? "flex" : "none";
  var only = document.getElementsByClassName("biaAdminOnly");
  for (var i = 0; i < only.length; i++) {
    only[i].style.display = mapAdmin ? "flex" : "none";
  }
  var cv = biaById("biaCancelVoteBtn");
  if (cv) cv.style.display = biaMapVoteActive ? "flex" : "none";
  biaI18nSoon();
}
var biaI18nPending = false;
function biaI18nSoon() {
  if (biaI18nPending || !biaPrefs.lang || biaPrefs.lang === "en") return;
  biaI18nPending = true;
  setTimeout(function () {
    biaI18nPending = false;
    biaI18nApply(document.body);
  }, 0);
}
(function biaWrapTabFunctions() {
  var names = [
    "showServerInfo",
    "showScoreboard",
    "showClientSettings",
    "mapRotationSetup",
    "clearScoreboardBody",
    "showTabsAndEnableMouse",
    "managePresets",
    "manageModSettings"
  ];
  for (var i = 0; i < names.length; i++) {
    (function (n) {
      var f = window[n];
      if (typeof f !== "function") return;
      window[n] = function () {
        var r = f.apply(this, arguments);
        try {
          biaEnforceTabs();
        } catch (e) {}
        return r;
      };
    })(names[i]);
  }
  // tooltips: mouseleave never fires once the GUI is hidden, so kill them here
  ["clearScoreboardBody", "closeSmart"].forEach(function (n) {
    var f = window[n];
    if (typeof f !== "function") return;
    window[n] = function () {
      biaKillTip();
      return f.apply(this, arguments);
    };
  });
  var origSetup = window.serverSetup;
  if (typeof origSetup === "function") {
    window.serverSetup = function () {
      if (!biaCanSeeSetup()) {
        biaEnforceTabs();
        return;
      }
      var r = origSetup.apply(this, arguments);
      try {
        biaEnforceTabs();
      } catch (e) {}
      return r;
    };
  }
})();

/* --- admin log (Manage Lists -> Admin Log) -------------------------------- */
var biaAdminLog = [];
function getAdminLog(args) {
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch (e) {
      args = [];
    }
  }
  biaAdminLog = args || [];
  if (biaListMode === "log") biaRenderList();
}

/* --- boot: ask client Lua for saved prefs + fresh rotation ------------------ */
(function biaBoot() {
  function run() {
    try {
      WebUI.Call("DispatchEvent", "WebUI:BiaGetUiPrefs");
    } catch (e) {}
    try {
      WebUI.Call("DispatchEvent", "WebUI:BiaKeyboard", "0");
    } catch (e) {}
    biaRequestMapRotation(true);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(run, 800);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(run, 800);
    });
  }
})();

/* --- size the scrolling lists to the screen --------------------------------
   Shows as many rows as fit (up to 20 map rows / 20 queue rows) at the
   current resolution + UI zoom, instead of a fixed 252px (= 9 rows) box. */
function biaFitOne(el, maxPx, reservePx) {
  if (!el || el.offsetParent === null || !el.offsetHeight) return;
  var r = el.getBoundingClientRect();
  var s = r.height / el.offsetHeight;
  if (!s || s < 0.05) s = 1;
  var vh = window.innerHeight || 1080;
  var avail = (vh - r.top - vh * 0.03) / s - (reservePx || 0);
  el.style.maxHeight = Math.round(biaClamp(avail, 112, maxPx)) + "px";
}
function biaFitScrollLists() {
  var rs = biaById("mapRotationSettings");
  if (!rs || rs.style.display !== "flex") return;
  biaFitOne(biaById("mapRotationConfiguration"), 560, 0);
  var panel = biaById("mapQueuePanel");
  var reserve = 0;
  if (panel && panel.parentNode) {
    var sib = panel.nextSibling;
    while (sib) {
      if (sib.nodeType === 1 && sib.offsetHeight) reserve += sib.offsetHeight + 4;
      sib = sib.nextSibling;
    }
  }
  biaFitOne(biaById("mapQueueList"), 600, reserve);
  biaRefreshAllHints();
}
(function biaWrapFitters() {
  var f = window.mapRotationSetup;
  if (typeof f === "function") {
    window.mapRotationSetup = function () {
      var r = f.apply(this, arguments);
      setTimeout(biaFitScrollLists, 60);
      return r;
    };
  }
  var z = window.biaApplyUiZoom;
  window.biaApplyUiZoom = function () {
    var r = z.apply(this, arguments);
    setTimeout(biaFitScrollLists, 60);
    return r;
  };
  window.addEventListener("resize", function () {
    setTimeout(biaFitScrollLists, 60);
  });
})();

function biaKillTip() {
  biaHoldStop();
  if (biaTipTimer) {
    clearTimeout(biaTipTimer);
    biaTipTimer = null;
  }
  biaHideTip();
}

/* ==========================================================================
   BIA i18n - English source strings -> [zh, ru, uk, ja]
   Works on the rendered DOM (text nodes + placeholder/data-tip), so the
   ~250 strings in index.html and the JS-built UI are covered without
   touching every template. Map and mode names are deliberately NOT translated.
   To add/fix a translation just edit a line below.
   ========================================================================== */
var BIA_LANG_COL = { zh: 0, ru: 1, uk: 2, ja: 3 };
var BIA_I18N = {
  "# of Players to start round": ["开局所需玩家数", "Игроков для начала раунда", "Гравців для початку раунду", "ラウンド開始に必要な人数"],
  "# of TK before player is kicked": ["踢出前允许的误杀次数", "Убийств своих до кика", "Вбивств своїх до кіку", "キックまでのTK回数"],
  "3P Vehicle Cam": ["载具第三人称视角", "Вид от 3-го лица в технике", "Вид від 3-ї особи в техніці", "車両3人称カメラ"],
  "Actions for your squad": ["小队操作", "Действия для отряда", "Дії для загону", "分隊の操作"],
  "Actions for yourself": ["个人操作", "Действия для себя", "Дії для себе", "自分の操作"],
  "Add every map from the list (respects the mode filter)": ["添加列表中的所有地图（遵循模式筛选）", "Добавить все карты из списка (с учётом фильтра)", "Додати всі карти зі списку (з урахуванням фільтра)", "リストの全マップを追加（モード絞り込み適用）"],
  "Admin": ["管理员", "Админ", "Адмін", "管理者"],
  "Admin List": ["管理员列表", "Список админов", "Список адмінів", "管理者リスト"],
  "Admin Log": ["管理日志", "Журнал админов", "Журнал адмінів", "管理ログ"],
  "All": ["全部", "Все", "Усі", "すべて"],
  "Allow Deserting": ["允许逃离战区", "Разрешить дезертирство", "Дозволити дезертирство", "戦域離脱を許可"],
  "Announce the next maps in chat to all players": ["在聊天中向所有玩家公布接下来的地图", "Объявить следующие карты в чате", "Оголосити наступні карти в чаті", "次のマップをチャットで全員に告知"],
  "Apply": ["应用", "Применить", "Застосувати", "適用"],
  "Assist": ["协助", "Помощь", "Допомога", "アシスト"],
  "Assist function": ["协助功能", "Функция помощи", "Функція допомоги", "アシスト機能"],
  "Back": ["返回", "Назад", "Назад", "戻る"],
  "Back to 1.30x": ["恢复为 1.30x", "Вернуть 1.30x", "Повернути 1.30x", "1.30xに戻す"],
  "Ban": ["封禁", "Бан", "Бан", "BAN"],
  "Ban List": ["封禁列表", "Список банов", "Список банів", "BANリスト"],
  "Ban player after # of kicks": ["被踢出几次后封禁", "Бан после N киков", "Бан після N кіків", "キック回数でBAN"],
  "Big yell message on everyone's screen (8s)": ["在所有人屏幕上显示喊话（8秒）", "Крупное сообщение на экране у всех (8 с)", "Велике повідомлення на екрані в усіх (8 с)", "全員の画面にメッセージ（8秒）"],
  "Bigger": ["放大", "Крупнее", "Більше", "拡大"],
  "Bluetint": ["蓝色滤镜", "Синий оттенок", "Синій відтінок", "ブルーティント"],
  "Bullet Damage Modifier in %": ["子弹伤害倍率（%）", "Урон пуль, %", "Шкода куль, %", "弾丸ダメージ倍率（%）"],
  "CTF timelimit": ["夺旗时间限制", "Лимит времени CTF", "Ліміт часу CTF", "CTF制限時間"],
  "Can Alter Server Settings": ["可修改服务器设置", "Может менять настройки сервера", "Може змінювати налаштування сервера", "サーバー設定の変更"],
  "Can Ban": ["可封禁", "Может банить", "Може банити", "BAN可能"],
  "Can Edit Ban List": ["可编辑封禁列表", "Может править список банов", "Може редагувати список банів", "BANリスト編集"],
  "Can Edit Map List": ["可编辑地图列表", "Может править список карт", "Може редагувати список карт", "マップリスト編集"],
  "Can Edit Reserved Slot List": ["可编辑保留位列表", "Может править резервные слоты", "Може редагувати резервні слоти", "予約枠リスト編集"],
  "Can Edit Rights": ["可编辑权限", "Может менять права", "Може змінювати права", "権限の編集"],
  "Can Edit Text Chat Moderation List": ["可编辑聊天管理列表", "Может править модерацию чата", "Може редагувати модерацію чату", "チャット管理リスト編集"],
  "Can Kick": ["可踢出", "Может кикать", "Може кікати", "キック可能"],
  "Can Kill": ["可击杀", "Может убивать", "Може вбивати", "キル可能"],
  "Can Move": ["可移动", "Может перемещать", "Може переміщати", "移動可能"],
  "Can Shutdown Server": ["可关闭服务器", "Может выключить сервер", "Може вимкнути сервер", "サーバー停止"],
  "Can Tban": ["可临时封禁", "Может временно банить", "Може тимчасово банити", "一時BAN可能"],
  "Can Use Map Functions": ["可使用地图功能", "Может управлять картами", "Може керувати картами", "マップ機能の使用"],
  "Cancel Assist": ["取消协助", "Отменить помощь", "Скасувати допомогу", "アシスト取消"],
  "Cancel the running map vote": ["取消正在进行的地图投票", "Отменить текущее голосование за карту", "Скасувати поточне голосування за карту", "進行中のマップ投票を中止"],
  "Cancel vote": ["取消投票", "Отменить голос.", "Скасувати голос.", "投票中止"],
  "Chat message to everyone (Enter also sends)": ["向所有人发送聊天消息（回车也可发送）", "Сообщение в чат всем (Enter тоже отправляет)", "Повідомлення в чат усім (Enter теж надсилає)", "全員へのチャット（Enterでも送信）"],
  "Clear the entire map queue": ["清空地图队列", "Очистить очередь карт", "Очистити чергу карт", "マップキューを全消去"],
  "Click maps in the list to queue them.": ["点击列表中的地图将其加入队列。", "Нажмите на карту в списке, чтобы добавить её в очередь.", "Натисніть на карту в списку, щоб додати її до черги.", "リストのマップをクリックしてキューに追加。"],
  "Close": ["关闭", "Закрыть", "Закрити", "閉じる"],
  "Close Squad": ["关闭小队", "Закрыть отряд", "Закрити загін", "分隊を閉じる"],
  "Cooldown between votes": ["投票冷却时间", "Пауза между голосованиями", "Пауза між голосуваннями", "投票のクールダウン"],
  "Create Squad": ["创建小队", "Создать отряд", "Створити загін", "分隊を作成"],
  "Current Map": ["当前地图", "Текущая карта", "Поточна карта", "現在のマップ"],
  "Custom": ["自定义", "Своё", "Власне", "カスタム"],
  "Default Minimap Size": ["默认小地图大小", "Размер миникарты", "Розмір мінімапи", "ミニマップの既定サイズ"],
  "Default Voip Volume": ["默认语音音量", "Громкость голос. чата", "Гучність голос. чату", "ボイス既定音量"],
  "Delete": ["删除", "Удалить", "Видалити", "削除"],
  "Delete & Save": ["删除并保存", "Удал.+сохр.", "Видал.+збер.", "削除して保存"],
  "Destruction Enabled": ["启用破坏", "Разрушения", "Руйнування", "破壊を有効化"],
  "Edit rights": ["编辑权限", "Изменить права", "Змінити права", "権限を編集"],
  "FOV / zoom take effect on the next level load. Mouse sensitivity immediate. Saved on this PC.": ["FOV/缩放在下次载入地图时生效，鼠标灵敏度立即生效。保存在本机。", "FOV/зум применятся на следующей карте, чувствительность мыши — сразу. Сохраняется на этом ПК.", "FOV/зум застосуються на наступній карті, чутливість миші — одразу. Зберігається на цьому ПК.", "FOV／ズームは次のマップで反映。マウス感度は即時。このPCに保存。"],
  "Field Of View": ["视野", "Поле зрения", "Поле зору", "視野角"],
  "Field Of View (Broken)": ["视野（已损坏）", "Поле зрения (не работает)", "Поле зору (не працює)", "視野角（不具合）"],
  "Fit": ["适配", "Вписать", "Вписати", "合わせる"],
  "Friendly Fire": ["友军伤害", "Огонь по своим", "Вогонь по своїх", "フレンドリーファイア"],
  "General": ["常规", "Общие", "Загальні", "一般"],
  "Gun Master Weapons Preset": ["枪王武器预设", "Набор оружия Gun Master", "Набір зброї Gun Master", "ガンマスター武器プリセット"],
  "Heavy Gear": ["重装", "Тяжёлое снаряжение", "Важке спорядження", "ヘビーギア"],
  "Hide Votings": ["隐藏投票", "Скрыть голосования", "Приховати голосування", "投票を隠す"],
  "Hold Tab": ["按住 Tab", "Удерживать Tab", "Утримувати Tab", "Tab長押し"],
  "Holo FOV": ["全息 FOV", "Голо FOV", "Голо FOV", "ホロ FOV"],
  "Holo Multiplier": ["全息倍率", "Голо множитель", "Голо множник", "ホロ倍率"],
  "Insta": ["立即", "Сразу", "Одразу", "即時"],
  "Instavote: load this map right now": ["即时投票：立即载入此地图", "Мгновенно: загрузить эту карту сейчас", "Миттєво: завантажити цю карту зараз", "即時投票：このマップを今すぐ読み込む"],
  "Iron Sights, Kobra, RDS FOV": ["机械瞄具/Kobra/RDS FOV", "Мушка, Кобра, RDS FOV", "Мушка, Кобра, RDS FOV", "アイアンサイト・コブラ・RDS FOV"],
  "Iron Sights, Kobra, RDS Multiplier": ["机械瞄具/Kobra/RDS 倍率", "Мушка, Кобра, RDS множитель", "Мушка, Кобра, RDS множник", "アイアンサイト・コブラ・RDS 倍率"],
  "Join Squad": ["加入小队", "Вступить в отряд", "Вступити в загін", "分隊に参加"],
  "Kick": ["踢出", "Кик", "Кік", "キック"],
  "Kick IDLE Player after seconds": ["挂机玩家踢出时间（秒）", "Кик AFK через (сек)", "Кік AFK через (сек)", "放置プレイヤーのキック（秒）"],
  "Kick from Squad": ["踢出小队", "Выгнать из отряда", "Вигнати із загону", "分隊から追放"],
  "Kill": ["击杀", "Убить", "Вбити", "キル"],
  "Kill Cam": ["击杀镜头", "Камера смерти", "Камера смерті", "キルカメラ"],
  "Leave Squad": ["离开小队", "Покинуть отряд", "Покинути загін", "分隊を抜ける"],
  "Light Weight": ["轻装", "Лёгкое снаряжение", "Легке спорядження", "ライトウェイト"],
  "Load the queue head (orange row) right now": ["立即载入队首地图（橙色行）", "Загрузить первую карту очереди (оранжевая) сейчас", "Завантажити першу карту черги (помаранчева) зараз", "キュー先頭（オレンジ行）を今すぐ読み込む"],
  "Manage Admin List": ["管理员列表管理", "Управление админами", "Керування адмінами", "管理者リスト管理"],
  "Manage Ban List": ["封禁列表管理", "Управление банами", "Керування банами", "BANリスト管理"],
  "Manage Lists": ["列表管理", "Управление списками", "Керування списками", "リスト管理"],
  "Manage Mod Settings": ["模组设置管理", "Настройки мода", "Налаштування мода", "MOD設定の管理"],
  "Manage Presets": ["预设管理", "Пресеты", "Пресети", "プリセット管理"],
  "Map": ["地图", "Карта", "Карта", "マップ"],
  "Map Rotation": ["地图轮换", "Ротация карт", "Ротація карт", "マップローテーション"],
  "Max Players": ["最大玩家数", "Макс. игроков", "Макс. гравців", "最大人数"],
  "Maximum voting starts per player": ["每名玩家最多发起投票次数", "Макс. голосований от игрока", "Макс. голосувань від гравця", "1人あたりの投票開始上限"],
  "Message to all players...": ["发给所有玩家的消息…", "Сообщение всем игрокам…", "Повідомлення всім гравцям…", "全プレイヤーへのメッセージ…"],
  "Mod List": ["模组列表", "Список модов", "Список модів", "MOD一覧"],
  "Mode": ["模式", "Режим", "Режим", "モード"],
  "Mouse Sensitivity": ["鼠标灵敏度", "Чувств. мыши", "Чутлив. миші", "マウス感度"],
  "Move": ["移动", "Переместить", "Перемістити", "移動"],
  "Move down (double-click: bottom)": ["下移（双击：移到底部）", "Вниз (двойной клик: в конец)", "Вниз (подвійний клік: у кінець)", "下へ（ダブルクリックで最後へ）"],
  "Move up (double-click: top)": ["上移（双击：移到顶部）", "Вверх (двойной клик: в начало)", "Вгору (подвійний клік: на початок)", "上へ（ダブルクリックで先頭へ）"],
  "Move vote popup down": ["投票弹窗下移", "Окно голосования ниже", "Вікно голосування нижче", "投票ポップアップを下へ"],
  "Move vote popup left (hold to keep moving)": ["投票弹窗左移（按住持续移动）", "Окно голосования левее (удерживайте)", "Вікно голосування лівіше (утримуйте)", "投票ポップアップを左へ（長押しで連続）"],
  "Move vote popup right": ["投票弹窗右移", "Окно голосования правее", "Вікно голосування правіше", "投票ポップアップを右へ"],
  "Move vote popup up": ["投票弹窗上移", "Окно голосования выше", "Вікно голосування вище", "投票ポップアップを上へ"],
  "Mute": ["静音", "Заглушить", "Заглушити", "ミュート"],
  "Next Map": ["下一张地图", "Следующая карта", "Наступна карта", "次のマップ"],
  "Next Map Queue": ["地图队列", "Очередь карт", "Черга карт", "マップキュー"],
  "Next Round": ["下一回合", "След. раунд", "Наст. раунд", "次のラウンド"],
  "No": ["否", "Нет", "Ні", "いいえ"],
  "No Squad": ["无小队", "Без отряда", "Без загону", "分隊なし"],
  "No admin actions logged yet.": ["暂无管理操作记录。", "Действий админов пока нет.", "Дій адмінів поки немає.", "管理操作の記録はまだありません。"],
  "No banned players.": ["没有被封禁的玩家。", "Забаненных игроков нет.", "Забанених гравців немає.", "BANされたプレイヤーはいません。"],
  "No admins set.": ["未设置管理员。", "Админы не назначены.", "Адміни не призначені.", "管理者は未設定です。"],
  "No maps queued. Use Vote to pick the next map.": ["队列中没有地图。使用投票选择下一张地图。", "Очередь пуста. Выберите следующую карту голосованием.", "Черга порожня. Оберіть наступну карту голосуванням.", "キューは空です。投票で次のマップを選んでください。"],
  "Normal": ["普通", "Обычный", "Звичайний", "ノーマル"],
  "Normal Reversed": ["普通（反转）", "Обычный (инверсия)", "Звичайний (інверсія)", "ノーマル（反転）"],
  "Normal mode uses the standard Battlefield rules with all HUD elements visible, friendly fire off and regenerative health. Normal mode is both for the novice and pro players that want to have plain simple fun!": ["普通模式使用标准战地规则：显示全部 HUD、关闭友军伤害、生命自动恢复。适合想轻松畅玩的新手和老手！", "Обычный режим — стандартные правила Battlefield: весь HUD виден, огонь по своим выключен, здоровье восстанавливается. Для новичков и профи, которые хотят просто повеселиться!", "Звичайний режим — стандартні правила Battlefield: увесь HUD видно, вогонь по своїх вимкнено, здоров'я відновлюється. Для новачків і профі, які хочуть просто розважитися!", "ノーマルは標準ルール：HUD全表示、FFオフ、体力自動回復。初心者もベテランも気軽に楽しめます！"],
  "Number of rounds": ["回合数", "Число раундов", "Кількість раундів", "ラウンド数"],
  "OK": ["确定", "ОК", "ОК", "OK"],
  "On": ["开", "Вкл", "Увімк", "オン"],
  "Off": ["关", "Выкл", "Вимк", "オフ"],
  "Only Squad Leader Spawn": ["仅在小队长处重生", "Возрождение только на командире", "Відродження лише на командирі", "分隊長のみスポーン"],
  "Open Squad": ["公开小队", "Открыть отряд", "Відкрити загін", "分隊を公開"],
  "Overwrite on start": ["启动时覆盖", "Перезаписывать при старте", "Перезаписувати при старті", "起動時に上書き"],
  "Owner": ["服主", "Владелец", "Власник", "オーナー"],
  "PING": ["延迟", "ПИНГ", "ПІНГ", "PING"],
  "Password": ["密码", "Пароль", "Пароль", "パスワード"],
  "Ping": ["延迟", "Пинг", "Пінг", "Ping"],
  "Ping:": ["延迟：", "Пинг:", "Пінг:", "Ping:"],
  "Pistols Only": ["仅限手枪", "Только пистолеты", "Лише пістолети", "ピストルのみ"],
  "Player Health in %": ["玩家生命值（%）", "Здоровье игрока, %", "Здоров'я гравця, %", "プレイヤー体力（%）"],
  "Player Man Down Time in %": ["倒地时间（%）", "Время ранения, %", "Час поранення, %", "ダウン時間（%）"],
  "Player Respawn Time in %": ["重生时间（%）", "Время возрождения, %", "Час відродження, %", "リスポーン時間（%）"],
  "Player Voip Level": ["玩家语音音量", "Громкость голоса игрока", "Гучність голосу гравця", "プレイヤーのボイス音量"],
  "Players": ["玩家", "Игроки", "Гравці", "プレイヤー"],
  "Preset": ["预设", "Пресет", "Пресет", "プリセット"],
  "Press F8 to vote YES": ["按 F8 投赞成票", "F8 — голосовать ЗА", "F8 — голосувати ЗА", "F8で賛成"],
  "Press F9 to vote NO": ["按 F9 投反对票", "F9 — голосовать ПРОТИВ", "F9 — голосувати ПРОТИ", "F9で反対"],
  "Promote to SQ Leader": ["提升为小队长", "Сделать командиром", "Зробити командиром", "分隊長に任命"],
  "Promote to admin": ["提升为管理员", "Сделать админом", "Зробити адміном", "管理者に昇格"],
  "Random": ["随机", "Случайно", "Випадково", "ランダム"],
  "Re-read Admin/maplist.txt on the server (use after editing the file)": ["在服务器上重新读取 Admin/maplist.txt（编辑文件后使用）", "Перечитать Admin/maplist.txt на сервере (после правки файла)", "Перечитати Admin/maplist.txt на сервері (після редагування файлу)", "サーバーのAdmin/maplist.txtを再読込（編集後に使用）"],
  "Refresh": ["刷新", "Обновить", "Оновити", "更新"],
  "Refresh the map list from the server": ["从服务器刷新地图列表", "Обновить список карт с сервера", "Оновити список карт із сервера", "サーバーからマップリストを更新"],
  "Regenerative Health": ["生命恢复", "Регенерация здоровья", "Регенерація здоров'я", "体力自動回復"],
  "Region": ["地区", "Регион", "Регіон", "地域"],
  "Reload maplist.txt": ["重载 maplist.txt", "Перезагр. maplist.txt", "Перезав. maplist.txt", "maplist.txt再読込"],
  "Remove": ["移除", "Убрать", "Прибрати", "削除"],
  "Reset": ["重置", "Сброс", "Скинути", "リセット"],
  "Reset & Save": ["重置并保存", "Сброс+сохр.", "Скид.+збер.", "リセット保存"],
  "Reset Multipliers": ["重置倍率", "Сброс множит.", "Скид. множн.", "倍率リセット"],
  "Restart": ["重新开始", "Перезапуск", "Перезапуск", "リスタート"],
  "SCORE": ["得分", "ОЧКИ", "ОЧКИ", "スコア"],
  "Save": ["保存", "Сохранить", "Зберегти", "保存"],
  "Say": ["发送", "Сказать", "Сказати", "発言"],
  "Scale the menu to fit this screen": ["缩放菜单以适配屏幕", "Подогнать меню под экран", "Підігнати меню під екран", "メニューを画面に合わせる"],
  "Scoreboard": ["计分板", "Счёт", "Рахунок", "スコアボード"],
  "Select Next Map": ["选择下一张地图", "Выбор след. карты", "Вибір наст. карти", "次のマップを選択"],
  "Server Description": ["服务器描述", "Описание сервера", "Опис сервера", "サーバー説明"],
  "Server Info": ["服务器信息", "Инфо о сервере", "Інфо про сервер", "サーバー情報"],
  "Server Message": ["服务器消息", "Сообщение сервера", "Повідомлення сервера", "サーバーメッセージ"],
  "Server Name": ["服务器名称", "Имя сервера", "Назва сервера", "サーバー名"],
  "Server Setup": ["服务器设置", "Настр. сервера", "Налашт. сервера", "サーバー構成"],
  "Settings": ["设置", "Настройки", "Налаштування", "設定"],
  "Show HUD": ["显示 HUD", "Показывать HUD", "Показувати HUD", "HUD表示"],
  "Show Loading Screen Info": ["显示载入画面信息", "Инфо на экране загрузки", "Інфо на екрані завантаження", "ロード画面の情報表示"],
  "Show Minimap": ["显示小地图", "Показывать миникарту", "Показувати мінімапу", "ミニマップ表示"],
  "Show Ping": ["显示延迟", "Показывать пинг", "Показувати пінг", "Ping表示"],
  "Show a dummy vote popup for 5s so you can place it": ["显示 5 秒示例投票弹窗，方便调整位置", "Показать пробное окно голосования на 5 с", "Показати пробне вікно голосування на 5 с", "位置調整用に投票ポップアップを5秒表示"],
  "Show dead enemies on scoreboard": ["在计分板显示阵亡敌人", "Показывать убитых врагов в счёте", "Показувати вбитих ворогів у рахунку", "スコアボードに倒した敵を表示"],
  "Show enemy name tags": ["显示敌人名称标签", "Показывать ники врагов", "Показувати ніки ворогів", "敵の名前タグ表示"],
  "Shuffle the queue once": ["打乱一次队列", "Перемешать очередь", "Перемішати чергу", "キューを1回シャッフル"],
  "Small": ["小", "Маленький", "Малий", "小"],
  "Smaller": ["缩小", "Мельче", "Менше", "縮小"],
  "Snipers Heaven": ["狙击天堂", "Рай снайпера", "Рай снайпера", "スナイパー天国"],
  "Spectators": ["观战者", "Зрители", "Глядачі", "観戦者"],
  "Squad": ["小队", "Отряд", "Загін", "分隊"],
  "Squad Size": ["小队人数", "Размер отряда", "Розмір загону", "分隊人数"],
  "Start a public vote for this map": ["为此地图发起公开投票", "Начать голосование за эту карту", "Почати голосування за цю карту", "このマップの投票を開始"],
  "Start a public vote for this map as next": ["发起公开投票，将此地图设为下一张", "Голосование: эта карта следующей", "Голосування: ця карта наступною", "このマップを次にする投票を開始"],
  "Startup": ["启动", "Запуск", "Запуск", "起動時"],
  "Sun Flare": ["阳光眩光", "Блики солнца", "Відблиски сонця", "太陽フレア"],
  "Suppression Multiplier in %": ["压制倍率（%）", "Подавление, %", "Придушення, %", "制圧倍率（%）"],
  "Surrender": ["投降", "Сдаться", "Здатися", "降伏"],
  "TBan": ["临时封禁", "Врем. бан", "Тимч. бан", "一時BAN"],
  "Team Balance": ["队伍平衡", "Баланс команд", "Баланс команд", "チームバランス"],
  "Test": ["测试", "Тест", "Тест", "テスト"],
  "Tick Rate": ["刷新率", "Тикрейт", "Тікрейт", "ティックレート"],
  "Tickets in %": ["票数（%）", "Тикеты, %", "Тікети, %", "チケット（%）"],
  "Time Scale in %": ["时间流速（%）", "Скорость времени, %", "Швидкість часу, %", "時間倍率（%）"],
  "UI Zoom": ["界面缩放", "Масштаб UI", "Масштаб UI", "UI拡大"],
  "Unban": ["解封", "Разбанить", "Розбанити", "BAN解除"],
  "Unmute": ["取消静音", "Включить звук", "Увімкнути звук", "ミュート解除"],
  "Unranked Settings": ["非排名设置", "Нерейтинговые настройки", "Нерейтингові налаштування", "非ランク設定"],
  "Use 3D Spotting": ["使用 3D 标记", "3D-обнаружение", "3D-виявлення", "3Dスポット使用"],
  "Use Minimap Spotting": ["使用小地图标记", "Отметки на миникарте", "Позначки на мінімапі", "ミニマップスポット使用"],
  "Vehicle Disabling": ["载具瘫痪", "Выведение техники из строя", "Виведення техніки з ладу", "車両の行動不能化"],
  "Vehicles": ["载具", "Техника", "Техніка", "車両"],
  "Venice Unleashed Settings": ["Venice Unleashed 设置", "Настройки Venice Unleashed", "Налаштування Venice Unleashed", "Venice Unleashed設定"],
  "Vote": ["投票", "Голос", "Голос", "投票"],
  "Vote popup": ["投票弹窗", "Окно голос.", "Вікно голос.", "投票ポップアップ"],
  "Vote popup position": ["投票弹窗位置", "Позиция окна голосования", "Позиція вікна голосування", "投票ポップアップの位置"],
  "Vote passed": ["投票通过", "Голосование прошло", "Голосування пройшло", "投票可決"],
  "Vote failed": ["投票未通过", "Голосование провалено", "Голосування провалено", "投票否決"],
  "Vote cancelled": ["投票已取消", "Голосование отменено", "Голосування скасовано", "投票中止"],
  "Voteban": ["投票封禁", "Голосование за бан", "Голосування за бан", "投票BAN"],
  "Voteduration": ["投票时长", "Длительность голосования", "Тривалість голосування", "投票時間"],
  "Votekick": ["投票踢出", "Голосование за кик", "Голосування за кік", "投票キック"],
  "Voting participation needed in %": ["所需投票参与率（%）", "Нужная явка, %", "Потрібна явка, %", "必要な投票参加率（%）"],
  "Yell": ["喊话", "Крикнуть", "Крикнути", "叫ぶ"],
  "Yes": ["是", "Да", "Так", "はい"],
  "[Admin] Channel": ["[管理员] 频道", "[Админ] канал", "[Адмін] канал", "[管理者] チャンネル"],
  "[All] Channel": ["[全部] 频道", "[Все] канал", "[Усі] канал", "[全体] チャンネル"],
  "[Squad] Channel": ["[小队] 频道", "[Отряд] канал", "[Загін] канал", "[分隊] チャンネル"],
  "[Team] Channel": ["[队伍] 频道", "[Команда] канал", "[Команда] канал", "[チーム] チャンネル"],
  /* v3.2 */
  "Favorites": ["收藏", "Избранное", "Обране", "お気に入り"],
  "Load a saved queue": ["载入已保存的队列", "Загрузить сохранённую очередь", "Завантажити збережену чергу", "保存したキューを読み込む"],
  "Queue name...": ["队列名称…", "Имя очереди…", "Назва черги…", "キュー名…"],
  "Save current queue as...": ["将当前队列另存为…", "Сохранить очередь как…", "Зберегти чергу як…", "現在のキューを名前を付けて保存…"],
  "Delete selected saved queue": ["删除选中的已保存队列", "Удалить выбранную очередь", "Видалити вибрану чергу", "選択した保存キューを削除"],
  "No saved queues yet.": ["还没有已保存的队列。", "Сохранённых очередей нет.", "Збережених черг немає.", "保存したキューはまだありません。"],
  "Favorite loaded": ["已载入收藏", "Избранное загружено", "Обране завантажено", "お気に入りを読み込みました"],
  "map(s) from this favorite are no longer in maplist.txt and were skipped.": ["张地图已不在 maplist.txt 中，已跳过。", "карт(ы) из избранного больше нет в maplist.txt — пропущены.", "карт(и) з обраного вже немає в maplist.txt — пропущено.", "件のマップはmaplist.txtにないためスキップしました。"],
  "Name needed": ["需要名称", "Нужно имя", "Потрібна назва", "名前が必要です"],
  "Type a name for this queue first.": ["请先为此队列输入名称。", "Сначала введите имя очереди.", "Спершу введіть назву черги.", "先にキュー名を入力してください。"],
  "Queue empty": ["队列为空", "Очередь пуста", "Черга порожня", "キューが空です"],
  "Add maps to the queue first.": ["请先向队列添加地图。", "Сначала добавьте карты в очередь.", "Спершу додайте карти до черги.", "先にマップをキューに追加してください。"],
  "Favorites full": ["收藏已满", "Избранное заполнено", "Обране заповнене", "お気に入りがいっぱいです"],
  "Delete a saved queue first (max 10).": ["请先删除一个已保存的队列（最多 10 个）。", "Сначала удалите одну из очередей (макс. 10).", "Спершу видаліть одну з черг (макс. 10).", "先に保存キューを1つ削除してください（最大10）。"],
  "Nothing selected": ["未选择", "Ничего не выбрано", "Нічого не вибрано", "未選択"],
  "Pick a saved queue in the list first.": ["请先在列表中选择一个已保存的队列。", "Сначала выберите очередь в списке.", "Спершу виберіть чергу в списку.", "先にリストから保存キューを選んでください。"],
  "BIG": ["巨字", "КРУПНО", "ВЕЛИКО", "特大"],
  "Huge flashing message across everyone's screen (6s)": ["在所有人屏幕上显示巨大的闪烁消息（6秒）", "Огромное мигающее сообщение на экране у всех (6 с)", "Величезне блимаюче повідомлення на екрані в усіх (6 с)", "全員の画面に巨大な点滅メッセージ（6秒）"],
  "Round end wait": ["回合结束等待", "Пауза после раунда", "Пауза після раунду", "ラウンド終了後の待機"],
  "Seconds from round end until the next map loads (Off = game default, about 60s)": ["回合结束到载入下一张地图的秒数（关 = 游戏默认，约60秒）", "Секунд от конца раунда до загрузки следующей карты (Выкл = по умолчанию, ~60 с)", "Секунд від кінця раунду до завантаження наступної карти (Вимк = типово, ~60 с)", "ラウンド終了から次のマップ読込までの秒数（オフ＝既定、約60秒）"],
  "Shorter": ["缩短", "Короче", "Коротше", "短く"],
  "Longer": ["延长", "Дольше", "Довше", "長く"],
  "Pin me to the top of the scoreboard": ["将我固定在计分板顶部", "Закрепить меня вверху таблицы", "Закріпити мене вгорі таблиці", "自分をスコアボード上部に固定"],
  "Language": ["语言", "Язык", "Мова", "言語"],
  "Queue": ["队列", "Очередь", "Черга", "キュー"],
  "old favorite map(s) could not be identified - re-save this favorite once to fix it.": ["张旧收藏地图无法识别——重新保存一次此收藏即可修复。", "карт(ы) старого избранного не распознаны — пересохраните его один раз.", "карт(и) старого обраного не розпізнано — перезбережіть його один раз.", "件の古いお気に入りマップを特定できません。一度保存し直してください。"]
};

/* patterns for strings with a variable part ($1, $2 = captured groups) */
var BIA_I18N_RX = [
  [/^([\d.]+x) Multiplier$/, ["$1 倍率", "$1 множитель", "$1 множник", "$1 倍率"]],
  [/^(\d+) sec$/, ["$1 秒", "$1 сек", "$1 сек", "$1 秒"]],
  [/^Active: (.*)$/, ["活跃：$1", "Активно: $1", "Активно: $1", "アクティブ：$1"]],
  [/^Votekick player: (.*)$/, ["投票踢出玩家：$1", "Кик игрока: $1", "Кік гравця: $1", "投票キック：$1"]],
  [/^Voteban player: (.*)$/, ["投票封禁玩家：$1", "Бан игрока: $1", "Бан гравця: $1", "投票BAN：$1"]],
  [/^Next map: (.*)$/, ["下一张地图：$1", "Следующая карта: $1", "Наступна карта: $1", "次のマップ：$1"]],
  [/^Vote passed: (.*)$/, ["投票通过：$1", "Голосование прошло: $1", "Голосування пройшло: $1", "投票可決：$1"]],
  [/^Vote failed: (.*)$/, ["投票未通过：$1", "Голосование провалено: $1", "Голосування провалено: $1", "投票否決：$1"]],
  [/^Vote cancelled: (.*)$/, ["投票已取消：$1", "Голосование отменено: $1", "Голосування скасовано: $1", "投票中止：$1"]],
  [/^(\d+) \/ (\d+) needed$/, ["$1 / $2 票", "$1 / $2 нужно", "$1 / $2 потрібно", "$1 / 必要 $2"]],
  [/^Team (US|RU)$/, ["队伍 $1", "Команда $1", "Команда $1", "チーム $1"]],
  [/^Squad (Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Juliet|Kilo|Lima|Mike|November|Oscar|Papa|Quebec|Romeo|Sierra|Tango|Uniform|Victor|Whiskey|Xray|Yankee|Zulu|Celeste|Faith|Haggard|Preston|Redford|Sweetwater)$/, ["小队 $1", "Отряд $1", "Загін $1", "分隊 $1"]]
];

function biaT(en) {
  var out = biaT0(en);
  var lang = (typeof biaPrefs !== "undefined" && biaPrefs.lang) || "en";
  // CJK has no spaces, so long strings never wrapped and ran out of their
  // boxes. Zero-width spaces between characters give the layout break points.
  if ((lang === "zh" || lang === "ja") && out !== en && out && out.length > 10) {
    out = out.replace(/([\u3040-\u30FF\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u3002])(?=[^\s\u200B])/g, "$1\u200B");
  }
  return out;
}
function biaT0(en) {
  var lang = (typeof biaPrefs !== "undefined" && biaPrefs.lang) || "en";
  var col = BIA_LANG_COL[lang];
  if (col == null || en == null) return en;
  var key = String(en);
  var row = BIA_I18N[key];
  if (row && row[col]) return row[col];
  // index.html wraps long labels over several lines: match on collapsed spaces
  var flat = key.replace(/\s+/g, " ");
  var flatCore = flat.trim();
  if (flatCore !== key) {
    var r2 = BIA_I18N[flatCore];
    if (r2 && r2[col]) {
      var lead = /^\s*/.exec(key)[0];
      var tail = /\s*$/.exec(key)[0];
      return lead + r2[col] + tail;
    }
  }
  // keep surrounding whitespace, translate the core
  var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(key);
  if (m && m[2] !== key) {
    var inner = BIA_I18N[m[2]];
    if (inner && inner[col]) return m[1] + inner[col] + m[3];
  }
  for (var i = 0; i < BIA_I18N_RX.length; i++) {
    var rx = BIA_I18N_RX[i][0];
    var core = m ? m[2] : key;
    if (rx.test(core)) return (m ? m[1] : "") + core.replace(rx, BIA_I18N_RX[i][1][col]) + (m ? m[3] : "");
  }
  return en;
}

/* Walk the DOM once, translating text + placeholder/data-tip in place.
   Each node remembers its English source, so switching language (or back to
   English) is exact, and text the app rewrites later is picked up again. */
var BIA_I18N_ATTRS = ["placeholder", "data-tip"];
function biaI18nNode(n) {
  if (n.nodeType === 3) {
    var cur = n.nodeValue;
    if (!cur || !/[A-Za-z\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]/.test(cur)) return;
    var en = n._biaOut !== undefined && cur === n._biaOut ? n._biaEn : cur;
    var out = biaT(en);
    n._biaEn = en;
    n._biaOut = out;
    if (out !== cur) n.nodeValue = out;
    return;
  }
  if (n.nodeType !== 1) return;
  var tag = n.tagName;
  if (tag === "SCRIPT" || tag === "STYLE") return;
  var cls = n.className && typeof n.className === "string" ? n.className : "";
  if (!n._biaAttr) n._biaAttr = {};
  for (var a = 0; a < BIA_I18N_ATTRS.length; a++) {
    var name = BIA_I18N_ATTRS[a];
    var v = n.getAttribute(name);
    if (!v) continue;
    var rec = n._biaAttr[name];
    var src = rec && v === rec.out ? rec.en : v;
    var tr = biaT(src);
    n._biaAttr[name] = { en: src, out: tr };
    if (tr !== v) n.setAttribute(name, tr);
  }

  // player rows and map names: never touched (fast path + no false hits)
  if (
    cls.indexOf("sbBody") !== -1 ||
    cls.indexOf("mapRotationFieldElementMap") !== -1 ||
    cls.indexOf("biaNoI18n") !== -1 ||
    cls.indexOf("biaKeepFont") !== -1 ||
    n.id === "biaBigYell"
  )
    return;
  var kids = n.childNodes;
  for (var i = 0; i < kids.length; i++) biaI18nNode(kids[i]);
}
function biaI18nApply(root) {
  if (!root) return;
  var lang = (biaPrefs && biaPrefs.lang) || "en";
  if (lang === "en" && !biaI18nEverRan) return;
  biaI18nEverRan = true;
  biaI18nNode(root);
}
var biaI18nEverRan = false;
/* cheap periodic pass while something is on screen; also runs after renders */
setInterval(function () {
  if (!biaPrefs || !biaPrefs.lang || biaPrefs.lang === "en") return;
  var sb = biaById("scoreboard");
  var vp = biaById("votepopup");
  var pop = biaById("popup");
  if (sb && sb.style.display === "flex") biaI18nNode(sb);
  if (vp && vp.classList.contains("shown")) biaI18nNode(vp);
  if (pop && pop.style.display && pop.style.display !== "none") biaI18nNode(pop);
  var lists = biaById("biaListPanel");
  if (lists && lists.classList.contains("open")) biaI18nNode(lists);
}, 700);

/* ==========================================================================
   BIA v3.2 features
   ========================================================================== */

/* --- favorite queues (max 10, stored in mod.db) ---------------------------- */
var biaFavs = [];
var biaFavSelected = "";
var BIA_FAV_MAX = 10;

function biaFavRowHtml() {
  return (
    '<div id="biaFavPick" class="mapQueueBtn wide biaTipBtn" data-tip="Load a saved queue" onclick="biaFavToggleList()">' +
    '<span id="biaFavPickText">Favorites</span><span class="biaCaret"></span></div>' +
    '<div id="biaFavList"></div>' +
    '<input id="biaFavName" type="text" maxlength="24" placeholder="Queue name..." data-bia-enter="biaFavSave" />' +
    '<div class="mapQueueBtn wide biaTipBtn" data-tip="Save current queue as..." onclick="biaFavSave()">Save</div>' +
    '<div class="mapQueueBtn wide biaTipBtn" data-tip="Delete selected saved queue" onclick="biaFavDelete()">Delete</div>'
  );
}
function biaEnsureFavRow() {
  var panel = biaById("mapQueuePanel");
  if (!panel) return;
  var row = biaById("biaFavRow");
  if (!row) {
    row = document.createElement("div");
    row.id = "biaFavRow";
    row.className = "biaAdminOnly";
    row.innerHTML = biaFavRowHtml();
    var list = biaById("mapQueueList");
    panel.insertBefore(row, list || null);
    biaBindTooltips(row);
    try {
      WebUI.Call("DispatchEvent", "WebUI:BiaGetFavs");
    } catch (e) {}
  }
  biaRenderFavPick();
}
/* Lua -> JS: [{name, maps:[{index,name,mode}], random}] */
function biaSetFavs(list) {
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch (e) {
      list = [];
    }
  }
  biaFavs = list || [];
  var still = false;
  for (var i = 0; i < biaFavs.length; i++) if (biaFavs[i].name === biaFavSelected) still = true;
  if (!still) biaFavSelected = "";
  biaRenderFavPick();
}
function biaRenderFavPick() {
  var t = biaById("biaFavPickText");
  if (t) t.textContent = biaFavSelected || biaT("Favorites");
  var list = biaById("biaFavList");
  if (!list) return;
  if (!biaFavs.length) {
    list.innerHTML = '<div class="biaFavItem biaFavEmpty">' + biaT("No saved queues yet.") + "</div>";
    return;
  }
  var html = "";
  for (var i = 0; i < biaFavs.length; i++) {
    var f = biaFavs[i];
    var n = (f.maps && f.maps.length) || 0;
    html +=
      '<div class="biaFavItem' + (f.name === biaFavSelected ? " active" : "") + '" data-i="' + i +
      '" onclick="biaFavPick(' + i + ')"><span class="biaFavItemName biaUni">' + biaEsc(f.name) +
      '</span><span class="biaFavItemCount">' + n + (f.random ? " R" : "") + "</span></div>";
  }
  list.innerHTML = html;
}
function biaFavToggleList(force) {
  var list = biaById("biaFavList");
  if (!list) return;
  var open = force != null ? force : list.style.display !== "flex";
  list.style.display = open ? "flex" : "none";
}
/* engine codes (e.g. MP_001 / ConquestLarge0) for a 1-based list index */
function biaCodesForIndex(k) {
  if (!biaMapListCache) return { map: "", mode: "" };
  var wpm = parseInt(biaMapListCache.list[1], 10) || 3;
  var base = 2 + (Number(k) - 1) * wpm;
  return { map: biaMapListCache.list[base] || "", mode: biaMapListCache.list[base + 1] || "" };
}
/* Picking a favorite replaces the current queue. The SERVER resolves every
   entry by engine code (map + mode): maps still in the rotation are used as
   they are, maps that are no longer there are appended to the live rotation
   with mapList.add (maplist.txt itself is not modified), so every favorite
   map can still be played. Old favorites saved before codes were stored are
   matched by name + mode against the current list first. */
function biaFavPick(i) {
  var f = biaFavs[i];
  biaFavToggleList(false);
  if (!f || !biaIsMapAdmin()) return;
  biaFavSelected = f.name;
  var count = biaMapListCache ? parseInt(biaMapListCache.list[0], 10) || 0 : 0;
  var entries = [];
  var unknown = 0;
  var maps = f.maps || [];
  for (var m = 0; m < maps.length; m++) {
    var want = maps[m];
    var mapCode = want.map || "";
    var modeCode = want.gm || "";
    if (!mapCode || !modeCode) {
      for (var k = 1; k <= count; k++) {
        var el = biaById("mapRotationFieldElement" + k + "map");
        if (el && (el.textContent || "").trim() === want.name && (!want.mode || biaLookupModeForIndex(k) === want.mode)) {
          var c = biaCodesForIndex(k);
          mapCode = c.map;
          modeCode = c.mode;
          break;
        }
      }
    }
    if (mapCode && modeCode) entries.push({ map: mapCode, gm: modeCode, name: want.name, mode: want.mode || "" });
    else unknown++;
  }
  biaRenderFavPick();
  if (entries.length) {
    WebUI.Call("DispatchEvent", "WebUI:BiaApplyFav", JSON.stringify({ name: f.name, random: f.random === true, maps: entries }));
  }
  if (unknown > 0) {
    showPopupResponse([
      biaT("Favorite loaded"),
      unknown + " " + biaT("old favorite map(s) could not be identified - re-save this favorite once to fix it.")
    ]);
  }
}
function biaFavSave() {
  if (!biaIsMapAdmin()) return;
  var inp = biaById("biaFavName");
  var name = ((inp && inp.value) || biaFavSelected || "").replace(/\s+/g, " ").trim();
  if (!name) {
    showPopupResponse([biaT("Name needed"), biaT("Type a name for this queue first.")]);
    return;
  }
  if (!biaMapQueue.length) {
    showPopupResponse([biaT("Queue empty"), biaT("Add maps to the queue first.")]);
    return;
  }
  var exists = false;
  for (var i = 0; i < biaFavs.length; i++) if (biaFavs[i].name === name) exists = true;
  if (!exists && biaFavs.length >= BIA_FAV_MAX) {
    showPopupResponse([biaT("Favorites full"), biaT("Delete a saved queue first (max 10).")]);
    return;
  }
  biaFavSelected = name;
  var maps = [];
  for (var m = 0; m < biaMapQueue.length; m++) {
    var codes = biaCodesForIndex(biaMapQueue[m].index);
    maps.push({
      index: biaMapQueue[m].index,
      name: biaMapQueue[m].name,
      mode: biaMapQueue[m].mode || "",
      map: codes.map,
      gm: codes.mode
    });
  }
  WebUI.Call("DispatchEvent", "WebUI:BiaSaveFav", JSON.stringify({ name: name, maps: maps, random: biaQueueRandom === true }));
  if (inp) inp.value = "";
}
function biaFavDelete() {
  if (!biaIsMapAdmin() || !biaFavSelected) {
    showPopupResponse([biaT("Nothing selected"), biaT("Pick a saved queue in the list first.")]);
    return;
  }
  WebUI.Call("DispatchEvent", "WebUI:BiaDeleteFav", JSON.stringify(biaFavSelected));
  biaFavSelected = "";
  biaRenderFavPick();
}
document.addEventListener("mousedown", function (e) {
  var list = biaById("biaFavList");
  if (!list || list.style.display !== "flex") return;
  var t = e.target;
  while (t) {
    if (t.id === "biaFavList" || t.id === "biaFavPick") return;
    t = t.parentNode;
  }
  list.style.display = "none";
});

/* --- EXTRA YELL: huge flashing text, about a quarter of the screen tall ----- */
var biaBigYellTimer = null;
var biaBigYellFlash = null;
var BIA_YELL_COLORS = ["#ff3030", "#ffb000", "#ffffff", "#ff7a00"]; // alarm palette
function biaBigYell(p) {
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch (e) {
      p = { text: p };
    }
  }
  if (!p || !p.text) return;
  var el = biaById("biaBigYell");
  if (!el) {
    el = document.createElement("div");
    el.id = "biaBigYell";
    el.innerHTML = '<div id="biaBigYellText"></div><div id="biaBigYellFrom"></div>';
    document.body.appendChild(el);
  }
  var txt = biaById("biaBigYellText");
  txt.textContent = String(p.text);
  biaById("biaBigYellFrom").textContent = p.from ? "- " + p.from : "";
  el.style.display = "flex";

  // place + size in real screen pixels (body is transform-scaled)
  var body = document.body;
  var br = body.getBoundingClientRect();
  var s = br.width / (body.offsetWidth || 1074);
  if (!s || s < 0.05) s = 1;
  var vw = window.innerWidth || 1920;
  var vh = window.innerHeight || 1080;
  el.style.position = "absolute";
  el.style.left = (0 - br.left) / s + "px";
  el.style.top = (vh * 0.22 - br.top) / s + "px";
  el.style.width = vw / s + "px";
  var size = (vh * 0.2) / s; // cap-height ~ 1/4 of the screen incl. line gap
  txt.style.fontSize = size + "px";
  txt.style.lineHeight = size * 1.1 + "px";
  // shrink long messages until they fit on one line
  for (var i = 0; i < 12 && txt.offsetWidth * s > vw * 0.94; i++) {
    size *= 0.85;
    txt.style.fontSize = size + "px";
    txt.style.lineHeight = size * 1.1 + "px";
  }
  var n = 0;
  if (biaBigYellFlash) clearInterval(biaBigYellFlash);
  biaBigYellFlash = setInterval(function () {
    n++;
    txt.style.color = BIA_YELL_COLORS[n % BIA_YELL_COLORS.length];
    el.style.opacity = n % 2 ? "1" : "0.85";
  }, 170);
  if (biaBigYellTimer) clearTimeout(biaBigYellTimer);
  biaBigYellTimer = setTimeout(function () {
    clearInterval(biaBigYellFlash);
    biaBigYellFlash = null;
    biaBigYellTimer = null;
    el.style.display = "none";
  }, (p.seconds || 6) * 1000);
}

/* --- round-end wait (seconds from round end to next map; 0 = game default) -- */
var biaRoundEnd = 0;
var biaRoundEndSendTimer = null;
var BIA_ROUNDEND_STEPS = [0, 5, 10, 15, 20, 25, 30, 40, 45, 50, 55];
function biaSetRoundEnd(p) {
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch (e) {
      p = { seconds: +p };
    }
  }
  biaRoundEnd = p && p.seconds != null ? +p.seconds || 0 : 0;
  biaRenderRoundEnd();
}
function biaRenderRoundEnd() {
  var v = biaById("biaRoundEndVal");
  if (v) v.textContent = biaRoundEnd > 0 ? biaRoundEnd + "s" : biaT("Off");
}
function biaRoundEndStep(dir) {
  var i = 0;
  for (var k = 0; k < BIA_ROUNDEND_STEPS.length; k++) {
    if (BIA_ROUNDEND_STEPS[k] <= biaRoundEnd) i = k;
  }
  i = biaClamp(i + dir, 0, BIA_ROUNDEND_STEPS.length - 1);
  biaRoundEnd = BIA_ROUNDEND_STEPS[i];
  biaRenderRoundEnd();
  if (biaRoundEndSendTimer) clearTimeout(biaRoundEndSendTimer);
  biaRoundEndSendTimer = setTimeout(function () {
    biaRoundEndSendTimer = null;
    WebUI.Call("DispatchEvent", "WebUI:BiaSetRoundEnd", JSON.stringify(biaRoundEnd));
  }, 600);
}

/* --- pin local player to the top of the scoreboard ------------------------- */
function biaTogglePin() {
  biaPrefs.pinMe = !biaPrefs.pinMe;
  biaPrefsSave();
  biaApplyPin();
  biaSbSizeBodies();
  biaRefreshAllHints();
}
function biaApplyPin() {
  var old = biaById("biaPinnedRow");
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var me = biaById("localPlayerScoreboard");
  if (!me) return;
  var cells = me.children;
  var nameCell = cells && cells.length > 1 ? cells[1] : null;
  if (nameCell && !nameCell.querySelector(".biaPinBox")) {
    var box = document.createElement("div");
    box.className = "biaPinBox biaTipBtn";
    box.setAttribute("data-tip", "Pin me to the top of the scoreboard");
    box.setAttribute("onmousedown", "event.stopPropagation();biaTogglePin()");
    nameCell.insertBefore(box, nameCell.firstChild);
    try {
      biaBindTooltips(me);
    } catch (e) {}
  }
  var boxes = document.getElementsByClassName("biaPinBox");
  for (var b = 0; b < boxes.length; b++) {
    if (biaPrefs.pinMe) boxes[b].classList.add("checked");
    else boxes[b].classList.remove("checked");
  }
  if (!biaPrefs.pinMe) return;
  // pinned copy lives in the table head, which never scrolls
  var body = me.parentNode;
  var tableId = body && body.id ? body.id.replace("tbody", "") : "";
  var head = biaById(tableId + "head");
  if (!head) return;
  var copy = me.cloneNode(true);
  copy.id = "biaPinnedRow";
  copy.classList.add("biaPinned");
  head.appendChild(copy);
  try {
    biaBindTooltips(copy);
  } catch (e) {}
}

/* --- language picker ---------------------------------------------------------- */
var BIA_LANGS = [
  { id: "en", flag: "eng", label: "EN", name: "English" },
  { id: "zh", flag: "chin", label: "ZH", name: "Chinese" },
  { id: "ru", flag: "rus", label: "RU", name: "Russian" },
  { id: "uk", flag: "ukr", label: "UK", name: "Ukrainian" },
  { id: "ja", flag: "jap", label: "JA", name: "Japanese" }
];
function biaLangInfo(id) {
  for (var i = 0; i < BIA_LANGS.length; i++) if (BIA_LANGS[i].id === id) return BIA_LANGS[i];
  return BIA_LANGS[0];
}
function biaLangPickerHtml() {
  var cur = biaLangInfo(biaPrefs.lang || "en");
  var html =
    '<div id="biaLangBtn" class="biaZoomBtn wide biaTipBtn" data-tip="Language" onclick="biaLangToggle()">' +
    '<img id="biaLangFlag" class="biaFlag" src="images/' + cur.flag + '.png" /><span id="biaLangCode" class="biaKeepFont">' + cur.label + "</span></div>" +
    '<div id="biaLangList" class="biaNoI18n">';
  for (var i = 0; i < BIA_LANGS.length; i++) {
    var l = BIA_LANGS[i];
    html +=
      '<div class="biaLangItem" onclick="biaSetLang(\'' + l.id + '\')"><img class="biaFlag" src="images/' + l.flag +
      '.png" /><span class="biaLangLabel biaKeepFont">' + l.name + "</span></div>";
  }
  return html + "</div>";
}
function biaLangToggle(force) {
  var list = biaById("biaLangList");
  if (!list) return;
  var open = force != null ? force : list.style.display !== "flex";
  list.style.display = open ? "flex" : "none";
}
function biaSetLang(id) {
  biaLangToggle(false);
  biaPrefs.lang = biaLangInfo(id).id;
  biaPrefsSave();
  biaApplyLang();
}
function biaApplyLang() {
  var lang = biaPrefs.lang || "en";
  var cur = biaLangInfo(lang);
  var flag = biaById("biaLangFlag");
  if (flag) flag.setAttribute("src", "images/" + cur.flag + ".png");
  var code = biaById("biaLangCode");
  if (code) code.textContent = cur.label;
  var root = document.documentElement;
  // bffont (Purista) has no Cyrillic/CJK glyphs -> switch the whole UI font
  root.classList.remove("biaCyr");
  root.classList.remove("biaCJK");
  if (lang === "ru" || lang === "uk") root.classList.add("biaCyr");
  else if (lang === "zh" || lang === "ja") root.classList.add("biaCJK");
  // this setting is per player: stored on this PC (SettingsManager +
  // localStorage via biaPrefsSave), never sent to the server
  biaI18nApply(document.body);
  biaRenderFavPick();
  biaRenderRoundEnd();
}
document.addEventListener("mousedown", function (e) {
  var list = biaById("biaLangList");
  if (!list || list.style.display !== "flex") return;
  var t = e.target;
  while (t) {
    if (t.id === "biaLangList" || t.id === "biaLangBtn") return;
    t = t.parentNode;
  }
  list.style.display = "none";
});


/* --- typing in RU/UK -----------------------------------------------------------
   VU passes typed keys to the page in the Windows ANSI code page: with a
   Russian/Ukrainian layout that is Windows-1251, read as Latin-1, so
   "фыва" arrived as "ôûâà". Map those bytes back to Cyrillic (incl.
   Ukrainian Ґ Є І Ї). Pasted text is already correct and is untouched.
   Side effect: Western accented letters (é, ü) typed on a keyboard would
   also turn Cyrillic - fine for EN/RU/UK/ZH/JA players. */
var BIA_CP1251_EXTRA = {
  0xa8: 0x0401, 0xb8: 0x0451, // Ё ё
  0xa5: 0x0490, 0xb4: 0x0491, // Ґ ґ
  0xaa: 0x0404, 0xba: 0x0454, // Є є
  0xaf: 0x0407, 0xbf: 0x0457, // Ї ї
  0xb2: 0x0406, 0xb3: 0x0456  // І і
};
function biaFixCp1251(el) {
  var v = el.value;
  if (!v || !/[\u00A5-\u00FF]/.test(v)) return;
  var out = "";
  var changed = false;
  for (var i = 0; i < v.length; i++) {
    var c = v.charCodeAt(i);
    var u = c >= 0xc0 && c <= 0xff ? c + 0x350 : BIA_CP1251_EXTRA[c];
    if (u) {
      out += String.fromCharCode(u);
      changed = true;
    } else {
      out += v.charAt(i);
    }
  }
  if (!changed) return;
  var pos = el.selectionStart;
  el.value = out;
  try {
    if (pos != null) el.setSelectionRange(pos, pos);
  } catch (e) {}
}
document.addEventListener(
  "input",
  function (e) {
    if (biaIsTextField(e.target)) biaFixCp1251(e.target);
  },
  true
);

/* --- Say / Yell with Chinese/Japanese ---------------------------------------
   BF3's chat can't draw CJK, so the server sends those messages here instead
   and the mod draws them itself (all-language font):
     say  -> feed in the upper left under the chat, ~1/8 of BIG, white
     yell -> centred low on screen, ~1/5 of BIG, blue */
function biaScreenPlace(el, x, y, w) {
  var body = document.body;
  var br = body.getBoundingClientRect();
  var s = br.width / (body.offsetWidth || 1074);
  if (!s || s < 0.05) s = 1;
  el.style.position = "absolute";
  el.style.left = (x - br.left) / s + "px";
  el.style.top = (y - br.top) / s + "px";
  if (w != null) el.style.width = w / s + "px";
  return s;
}
var biaYellTimer = null;
function biaChatOverlay(p) {
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch (e) {
      return;
    }
  }
  if (!p || !p.text) return;
  var vw = window.innerWidth || 1920;
  var vh = window.innerHeight || 1080;
  var big = vh * 0.2; // BIG yell font size
  if (p.kind === "yell") {
    var y = biaById("biaYellBox");
    if (!y) {
      y = document.createElement("div");
      y.id = "biaYellBox";
      y.className = "biaUni";
      document.body.appendChild(y);
    }
    y.textContent = String(p.text);
    y.style.display = "flex";
    var s = biaScreenPlace(y, 0, vh * 0.7, vw);
    y.style.fontSize = big / 5 / s + "px";
    y.style.lineHeight = (big / 5) * 1.25 / s + "px";
    if (biaYellTimer) clearTimeout(biaYellTimer);
    biaYellTimer = setTimeout(function () {
      biaYellTimer = null;
      y.style.display = "none";
    }, (p.seconds || 8) * 1000);
    return;
  }
  var feed = biaById("biaSayFeed");
  if (!feed) {
    feed = document.createElement("div");
    feed.id = "biaSayFeed";
    document.body.appendChild(feed);
  }
  var s2 = biaScreenPlace(feed, vw * 0.015, vh * 0.25, vw * 0.4);
  var line = document.createElement("div");
  line.className = "biaSayLine biaUni";
  line.style.fontSize = big / 8 / s2 + "px";
  line.style.lineHeight = (big / 8) * 1.3 / s2 + "px";
  line.textContent = (p.from ? "[" + p.from + "] " : "") + p.text;
  feed.appendChild(line);
  while (feed.children.length > 6) feed.removeChild(feed.firstChild);
  setTimeout(function () {
    if (line.parentNode) line.parentNode.removeChild(line);
  }, 12000);
}

/* --- labels that don't fit: slide on hover (like the mode name in Server Info) */
var BIA_SLIDE_CLASSES = ["resetAndSave", "closeTab", "applyMultipliers", "resetFov", "resetMouseSensitivityMultipliers",
  "serverSetupButtons", "serverSetupManageButtons", "mapRotationButtons", "biaListTab", "mapQueueBtn", "biaChip", "headertab"];
var biaSlide = null;
function biaSlideStop() {
  if (!biaSlide) return;
  clearInterval(biaSlide.timer);
  biaSlide.el.scrollLeft = 0;
  biaSlide = null;
}
function biaSlideTarget(t) {
  for (var d = 0; t && d < 4; d++, t = t.parentNode) {
    if (!t.classList) continue;
    for (var i = 0; i < BIA_SLIDE_CLASSES.length; i++) {
      if (t.classList.contains(BIA_SLIDE_CLASSES[i])) return t;
    }
    if (t.id === "serverSetup" || t.id === "mapRotationSetup") return t;
  }
  return null;
}
document.addEventListener("mouseover", function (e) {
  var el = biaSlideTarget(e.target);
  if (biaSlide && biaSlide.el === el) return;
  biaSlideStop();
  if (!el) return;
  var over = (el.scrollWidth || 0) - (el.clientWidth || 0);
  if (over < 3) return;
  el.style.overflow = "hidden";
  el.style.whiteSpace = "nowrap";
  var state = { el: el, pos: 0, wait: 20, dir: 1, timer: null };
  state.timer = setInterval(function () {
    if (state.wait > 0) {
      state.wait--;
      return;
    }
    state.pos += state.dir * 2;
    if (state.pos >= over) {
      state.pos = over;
      state.dir = -1;
      state.wait = 30;
    } else if (state.pos <= 0) {
      state.pos = 0;
      state.dir = 1;
      state.wait = 30;
    }
    el.scrollLeft = state.pos;
  }, 30);
  biaSlide = state;
});
