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
    document.getElementById("votepopup").classList.add("shown");
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
    document.getElementById("votepopup").classList.add("shown");
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
    document.getElementById("votepopup").classList.add("shown");
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
  let currentMapIndex = args[45][0];
  let nextMapIndex = args[45][1];
  document.getElementById("mapRotationConfiguration").innerHTML = "";
  document.getElementById("mapListConfiguration").innerHTML = "";
  let o = 1;
  let n = 1;
  let map = "UNDEFINED";
  let mapUrl = "UNDEFINED";
  for (let i = 2; i < parseInt(args[44][0]) * 3 + 2; i++) {
    if (o == 1) {
      map = generateMapName(args[44][i]);
      let k = (i + 1) / 3;
      document.getElementById("mapRotationConfiguration").innerHTML +=
        '<div onclick="biaQueueMapByIndex(' +
        k +
        ')" class="mapRotationFieldElement" id="mapRotationFieldElement' +
        k +
        '"></div>';
      document.getElementById("mapRotationFieldElement" + k).innerHTML +=
        '<div class="mapRotationFieldElementMap" id="mapRotationFieldElement' +
        k +
        'map">' +
        map +
        "</div>";
      document.getElementById("mapListConfiguration").innerHTML +=
        '<div class="mapListFieldElement" id="mapListFieldElement' +
        k +
        '"></div>';
      document.getElementById("mapListFieldElement" + k).innerHTML +=
        '<div class="mapListFieldElementMap" id="mapListFieldElement' +
        k +
        'map">' +
        map +
        "</div>";
    } else if (o == 2) {
      n = i - 1;
      let k = (n + 1) / 3;
      let mode = generateModeName(args[44][i]);
      document.getElementById("mapRotationFieldElement" + k).innerHTML +=
        '<div class="mapRotationFieldElementGameMode" id="mapRotationFieldElement' +
        k +
        'gameMode">' +
        mode +
        "</div>";
      document.getElementById("mapListFieldElement" + k).innerHTML +=
        '<div class="mapListFieldElementGameMode" id="mapListFieldElement' +
        k +
        'gameMode">' +
        mode +
        "</div>";
      if (k - 1 == currentMapIndex && k - 1 == nextMapIndex) {
        let map = generateMapName(args[44][n]);
        document.getElementById("mapRotationCurrentMap").innerHTML =
          map + ", " + mode;
        document.getElementById("mapRotationNextMap").innerHTML =
          map + ", " + mode;
        document.getElementById(
          "mapRotationFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap2"></div><div class="mapMarker next" id="nextMap2"></div>';
        document.getElementById("serverInfoMapBody").innerHTML = map;
        let mapUrl = generateMapUrl(args[44][n]);
        document.getElementById("serverInfoMapImg").style.backgroundImage =
          "url(fb://" + mapUrl + ")";
        document.getElementById("serverInfoMapRotationBody").innerHTML =
          '<p id="checkModeName"><span class="textMove">' +
          mode +
          "</span></p>";
        document.getElementById("serverInfoModeBody").innerHTML = mode;
        let modeImgUrl = generateModeUrl(args[44][i]);
        document.getElementById("serverInfoModeImg").style.backgroundImage =
          "url(fb://" + modeImgUrl + ")";
        document.getElementById(
          "mapListFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap"></div><div class="mapMarker next" id="nextMap"></div>';
      } else if (k - 1 == currentMapIndex) {
        let map = generateMapName(args[44][n]);
        document.getElementById("mapRotationCurrentMap").innerHTML =
          map + ", " + mode;
        document.getElementById(
          "mapRotationFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap2"></div>';
        document.getElementById("serverInfoMapBody").innerHTML = map;
        let mapUrl = generateMapUrl(args[44][n]);
        document.getElementById("serverInfoMapImg").style.backgroundImage =
          "url(fb://" + mapUrl + ")";
        document.getElementById("serverInfoMapRotationBody").innerHTML =
          '<p id="checkModeName"><span class="textMove">' +
          mode +
          "</span></p>";
        document.getElementById("serverInfoModeBody").innerHTML = mode;
        let modeImgUrl = generateModeUrl(args[44][i]);
        document.getElementById("serverInfoModeImg").style.backgroundImage =
          "url(fb://" + modeImgUrl + ")";
        document.getElementById(
          "mapListFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap"></div>';
      } else if (k - 1 == nextMapIndex) {
        document.getElementById("mapRotationNextMap").innerHTML =
          map + ", " + mode;
        document.getElementById(
          "mapRotationFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker next" id="nextMap2"></div>';
        document.getElementById(
          "mapListFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker next" id="nextMap"></div>';
      }
    } else if (o == 3) {
      n = i - 2;
      let k = (n + 1) / 3;
      //document.getElementById("mapRotationFieldElement"+k).innerHTML += '<div class="mapRotationFieldElementRounds" id="mapRotationFieldElement'+k+'rounds">'+args[44][i]+'</div>';
      o = 0;
    }
    o++;
  }
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
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("EnableKeyboard");
}

function resetMouseSensitivityMultipliers() {
  WebUI.Call("DispatchEvent", "WebUI:ResetMouseSensitivityMultipliers");
}

function saveMouseSensitivityMultipliers() {
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call(
    "DispatchEvent",
    "WebUI:SetMouseSensitivity",
    document.getElementById("actualMouseSensitivity").value
  );
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
  WebUI.Call("EnableKeyboard");
}

function resetFieldOfView() {
  WebUI.Call("DispatchEvent", "WebUI:ResetFieldOfView");
}

function saveFieldOfView() {
  WebUI.Call("ResetKeyboard");
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
  closeSmart();
}
/* Endregion */

/* Region another close action for whatever reason */
function keyboardResetAndClosepopup() {
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("ResetKeyboard");
  const killArgs = [playerName, document.getElementById("killReason").value];
  WebUI.Call("DispatchEvent", "WebUI:KillPlayer", JSON.stringify(killArgs));
  closepopup();
}
function kick(playerName) {
  let playerNameInline = playerName;
  playerName = escapestring(playerName, true);

  WebUI.Call("DispatchEvent", "WebUI:IgnoreReleaseTab");
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("ResetKeyboard");
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
  closeEditAdminpopup();
}

function deleteAndSaveAdminRights(playerName) {
  const args = [playerName];
  WebUI.Call(
    "DispatchEvent",
    "WebUI:DeleteAndSaveAdminRights",
    JSON.stringify(args)
  );
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
}
// for the local Player:
function getAdminRights(abilities) {
  if (abilities == null) {
    admin = false;
    return;
  } else {
    admin = true;
  }
  if (abilities.canMovePlayers == true) {
    canMovePlayers = true;
  } else {
    canMovePlayers = false;
  }
  if (abilities.canKillPlayers == true) {
    canKillPlayers = true;
  } else {
    canKillPlayers = false;
  }
  if (abilities.canKickPlayers == true) {
    canKickPlayers = true;
  } else {
    canKickPlayers = false;
  }
  if (abilities.canTemporaryBanPlayers == true) {
    canTemporaryBanPlayers = true;
  } else {
    canTemporaryBanPlayers = false;
  }
  if (abilities.canPermanentlyBanPlayers == true) {
    canPermanentlyBanPlayers = true;
  } else {
    canPermanentlyBanPlayers = false;
  }
  if (abilities.canEditGameAdminList == true) {
    canEditGameAdminList = true;
  } else {
    canEditGameAdminList = false;
  }
  if (abilities.canEditBanList == true) {
    canEditBanList = true;
  } else {
    canEditBanList = false;
  }
  if (abilities.canEditMapList == true) {
    canEditMapList = true;
  } else {
    canEditMapList = false;
  }
  if (abilities.canUseMapFunctions == true) {
    canUseMapFunctions = true;
  } else {
    canUseMapFunctions = false;
  }
  if (abilities.canAlterServerSettings == true) {
    canAlterServerSettings = true;
  } else {
    canAlterServerSettings = false;
  }
  if (abilities.canEditReservedSlotsList == true) {
    canEditReservedSlotsList = true;
  } else {
    canEditReservedSlotsList = false;
  }
  if (abilities.canEditTextChatModerationList == true) {
    canEditTextChatModerationList = true;
  } else {
    canEditTextChatModerationList = false;
  }
  if (abilities.canShutdownServer == true) {
    canShutdownServer = true;
  } else {
    canShutdownServer = false;
  }
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
  squadCount.length = 0;
  place1 = 0;
  place2 = 0;
  document.getElementById("table1").innerHTML =
    '<div class="sbBody" id="table1tbody"><div class="sbRow" id="firstrow"><div class="sbCell" id="team1">RU</div><div class="sbCell" id="tickets1"></div><div class="sbCell" id="killsHeader1">K</div><div class="sbCell" id="deathsHeader1">D</div><div class="sbCell" id="scoreHeader1">SCORE</div><div class="sbCell" id="pingHeader1">PING</div></div></div>';
  document.getElementById("table2").innerHTML =
    '<div class="sbBody" id="table2tbody"><div class="sbRow" id="firstrow"><div class="sbCell" id="team2">US</div><div class="sbCell" id="tickets2"></div><div class="sbCell" id="killsHeader2">K</div><div class="sbCell" id="deathsHeader2">D</div><div class="sbCell" id="scoreHeader2">SCORE</div><div class="sbCell" id="pingHeader2">PING</div></div></div>';

  document.getElementById("team1").innerHTML = scoreboardHeader[0];
  document.getElementById("tickets1").innerHTML = scoreboardHeader[1];
  document.getElementById("team2").innerHTML = scoreboardHeader[2];
  document.getElementById("tickets2").innerHTML = scoreboardHeader[3];
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
  place3 = 0;
  place4 = 0;
  document.getElementById("table3").style.display = "flex";
  document.getElementById("table4").style.display = "flex";
  document.getElementById("table3").innerHTML =
    '<div class="sbBody" id="table3tbody"><div class="sbRow" id="firstrow"><div class="sbCell" id="team3">RU</div><div class="sbCell" id="tickets3"></div><div class="sbCell" id="killsHeader3">K</div><div class="sbCell" id="deathsHeader3">D</div><div class="sbCell" id="scoreHeader3">SCORE</div><div class="sbCell" id="pingHeader3">PING</div></div></div>';
  document.getElementById("table4").innerHTML =
    '<div class="sbBody" id="table4tbody"><div class="sbRow" id="firstrow"><div class="sbCell" id="team4">US</div><div class="sbCell" id="tickets4"></div><div class="sbCell" id="killsHeader4">K</div><div class="sbCell" id="deathsHeader4">D</div><div class="sbCell" id="scoreHeader4">SCORE</div><div class="sbCell" id="pingHeader4">PING</div></div></div>';

  document.getElementById("team3").innerHTML = scoreboardHeader[0];
  document.getElementById("tickets3").innerHTML = scoreboardHeader[1];
  document.getElementById("team4").innerHTML = scoreboardHeader[2];
  document.getElementById("tickets4").innerHTML = scoreboardHeader[3];
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
      document.getElementById("table1tbody").innerHTML +=
        '<div onmousedown="action(&grave;' +
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
        "</div></div>";
    } else {
      document.getElementById("table1tbody").innerHTML +=
        '<div onmousedown="action(&grave;' +
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
        "</div></div>";
    }
  } else if (localPlayerSquad == sendThis1[5] && localPlayerSquad != 0) {
    if (sendThis1[6] == true) {
      document.getElementById("table1tbody").innerHTML +=
        '<div onmousedown="action(&grave;' +
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
        "</div></div>";
    } else {
      document.getElementById("table1tbody").innerHTML +=
        '<div onmousedown="action(&grave;' +
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
        "</div></div>";
    }
  } else {
    if (sendThis1[6] == true) {
      document.getElementById("table1tbody").innerHTML +=
        '<div onmousedown="action(&grave;' +
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
        "</div></div>";
    } else {
      document.getElementById("table1tbody").innerHTML +=
        '<div onmousedown="action(&grave;' +
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
        "</div></div>";
    }
  }
}
function updateScoreboardBody2(sendThis2) {
  let playerNameArg = escapestring(sendThis2[1], true);
  sendThis2[1] = escapestring(sendThis2[1], false);

  place2 += 1;
  // sendThis2[5] = Alive status, sendThis2[7] = Kit Class string (e.g., 'ID_M_ASSAULT')
  if (sendThis2[5] == true) {
    document.getElementById("table2tbody").innerHTML +=
      '<div onmousedown="action(&grave;' +
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
      "</div></div>";
  } else {
    document.getElementById("table2tbody").innerHTML +=
      '<div onmousedown="action(&grave;' +
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
      "</div></div>";
  }
}
function updateScoreboardBody3(size) {
  while (size > place1) {
    document.getElementById("table1tbody").innerHTML +=
      '<div id="empty" class="sbRow"><div class="sbCell" id="place1"></div><div class="sbCell" id="name1"></div><div class="sbCell" id="kills1"></div><div class="sbCell" id="deaths1"></div><div class="sbCell" id="points1"></div><div class="sbCell" id="ping1"></div></div>';
    place1 += 1;
  }
  while (size > place2) {
    document.getElementById("table2tbody").innerHTML +=
      '<div id="empty" class="sbRow"><div class="sbCell" id="place2"></div><div class="sbCell" id="name2"></div><div class="sbCell" id="kills2"></div><div class="sbCell" id="deaths2"></div><div class="sbCell" id="points2"></div><div class="sbCell" id="ping2"></div></div>';
    place2 += 1;
  }
  document.getElementById("scoreboard").style.display = "flex";
  document.getElementById("tables").style.display = "flex";
  document.getElementById("table1").style.height = null;
  document.getElementById("table2").style.height = null;
  document.getElementById("table1").style.display = "flex";
  document.getElementById("table2").style.display = "flex";
}
function updateScoreboardBody4(sendThis3) {
  let playerNameArg = escapestring(sendThis3[1], true);
  sendThis3[1] = escapestring(sendThis3[1], false);

  place3 += 1;
  if (sendThis3[5] == true) {
    document.getElementById("table3tbody").innerHTML +=
      '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')"><div class="sbCell" id="place3">' +
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
      "</div></div>";
  } else {
    document.getElementById("table3tbody").innerHTML +=
      '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')" class="isDead"><div class="sbCell" id="place3">' +
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
      "</div></div>";
  }
}
function updateScoreboardBody5(sendThis4) {
  let playerNameArg = escapestring(sendThis4[1], true);
  sendThis4[1] = escapestring(sendThis4[1], false);

  place4 += 1;
  if (sendThis4[5] == true) {
    document.getElementById("table4tbody").innerHTML +=
      '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')"><div class="sbCell" id="place4">' +
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
      "</div></div>";
  } else {
    document.getElementById("table4tbody").innerHTML +=
      '<div onmousedown="action(&grave;' +
      playerNameArg +
      "&grave;, " +
      0 +
      ')" class="isDead"><div class="sbCell" id="place4">' +
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
      "</div></div>";
  }
}
function updateScoreboardBody6() {
  while (8 > place3) {
    document.getElementById("table3tbody").innerHTML +=
      '<div id="empty" class="sbRow"><div class="sbCell" id="place3"></div><div class="sbCell" id="name3"></div><div class="sbCell" id="kills3"></div><div class="sbCell" id="deaths3"></div><div class="sbCell" id="points3"></div><div class="sbCell" id="ping3"></div></div>';
    place3 += 1;
  }
  while (8 > place4) {
    document.getElementById("table4tbody").innerHTML +=
      '<div id="empty" class="sbRow"><div class="sbCell" id="place4"></div><div class="sbCell" id="name4"></div><div class="sbCell" id="kills4"></div><div class="sbCell" id="deaths4"></div><div class="sbCell" id="points4"></div><div class="sbCell" id="ping4"></div></div>';
    place4 += 1;
  }
  document.getElementById("table1").style.height = null;
  document.getElementById("table2").style.height = null;
  document.getElementById("table3").style.height = null;
  document.getElementById("table4").style.height = null;
  let height = document.getElementById("table1").clientHeight * 0.558;
  document.getElementById("table1").style.height = height + "px";
  document.getElementById("table2").style.height = height + "px";
  document.getElementById("table3").style.height = height + "px";
  document.getElementById("table4").style.height = height + "px";
  document.getElementById("table3").style.display = "flex";
  document.getElementById("table4").style.display = "flex";
}
function clearScoreboardBody() {
  document.getElementById("mapRotationTab").style.display = null;
  document.getElementById("mapRotationSettings").style.display = null;
  document.getElementById("serverSetupTab").style.display = null;
  document.getElementById("serverSetupSettings").style.display = null;
  document.getElementById("settingsTab").style.display = null;
  closepopup();
  WebUI.Call("ResetMouse");
  WebUI.Call("ResetKeyboard");
  document.getElementById("scoreboard").style.display = "none";
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
  document.getElementById("table1").innerHTML =
    '<div class="sbBody" id="table1tbody"><div class="sbRow" id="firstrow"><div class="sbCell" id="team1">RU</div><div class="sbCell" id="tickets1">50</div><div class="sbCell" id="killsHeader1">K</div><div class="sbCell" id="deathsHeader1">D</div><div class="sbCell" id="scoreHeader1">SCORE</div><div class="sbCell" id="pingHeader1">PING</div></div></div>';
  document.getElementById("table2").innerHTML =
    '<div class="sbBody" id="table2tbody"><div class="sbRow" id="firstrow"><div class="sbCell" id="team2">US</div><div class="sbCell" id="tickets2">50</div><div class="sbCell" id="killsHeader2">K</div><div class="sbCell" id="deathsHeader2">D</div><div class="sbCell" id="scoreHeader2">SCORE</div><div class="sbCell" id="pingHeader2">PING</div></div></div>';
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
  document.getElementById("headertabs").style.display = "flex";
  document.getElementById("overlay").style.backgroundColor =
    "rgba(11, 35, 51, 0.28)";
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
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("ResetKeyboard");
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
  document.getElementById("mapRotationTab").style.display = null;
  document.getElementById("serverSetupTab").style.display = null;
  document.getElementById("serverSetupSettings").style.display = null;
  document.getElementById("managePresetsSettings").style.display = "none";
  document.getElementById("manageModSettings").style.display = "none";
  showGeneralClientSettings();
}
/* Endregion */

/* Region Client Settings */
function showGeneralClientSettings() {
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("DispatchEvent", "WebUI:GetMouseSensitivity");
  WebUI.Call("DispatchEvent", "WebUI:GetMouseSensitivityMultipliers");
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("DispatchEvent", "WebUI:GetFieldOfView");
  WebUI.Call("EnableKeyboard");
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
      document.getElementById("votepopup").classList.add("shown");
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
    document.getElementById("votepopup").classList.add("shown");
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

  document.getElementById("currentMap2").src =
    "fb://UI/Art/Menu/Icons/map_current";
  document.getElementById("nextMap2").src = "fb://UI/Art/Menu/Icons/map_next";
  document.getElementById("currentMap3").src =
    "fb://UI/Art/Menu/Icons/map_current";
  document.getElementById("nextMap3").src = "fb://UI/Art/Menu/Icons/map_next";

  biaEnsureQueuePanel();
  WebUI.Call("DispatchEvent", "WebUI:GetMapQueue");
}

function getCurrentMapRotation(args) {
  let currentMapIndex = args[1][0];
  let nextMapIndex = args[1][1];
  biaAdvanceQueue(currentMapIndex);
  document.getElementById("mapRotationConfiguration").innerHTML = "";
  document.getElementById("mapListConfiguration").innerHTML = "";
  let o = 1;
  let n = 1;
  let map = "UNDEFINED";
  let mapUrl = "UNDEFINED";
  for (let i = 2; i < parseInt(args[0][0]) * 3 + 2; i++) {
    if (o == 1) {
      map = generateMapName(args[0][i]);
      let k = (i + 1) / 3;
      document.getElementById("mapRotationConfiguration").innerHTML +=
        '<div onclick="biaQueueMapByIndex(' +
        k +
        ')" class="mapRotationFieldElement" id="mapRotationFieldElement' +
        k +
        '"></div>';
      document.getElementById("mapRotationFieldElement" + k).innerHTML +=
        '<div class="mapRotationFieldElementMap" id="mapRotationFieldElement' +
        k +
        'map">' +
        map +
        "</div>";
      document.getElementById("mapListConfiguration").innerHTML +=
        '<div class="mapListFieldElement" id="mapListFieldElement' +
        k +
        '"></div>';
      document.getElementById("mapListFieldElement" + k).innerHTML +=
        '<div class="mapListFieldElementMap" id="mapListFieldElement' +
        k +
        'map">' +
        map +
        "</div>";
    } else if (o == 2) {
      n = i - 1;
      let k = (n + 1) / 3;
      let mode = generateModeName(args[0][i]);
      document.getElementById("mapRotationFieldElement" + k).innerHTML +=
        '<div class="mapRotationFieldElementGameMode" id="mapRotationFieldElement' +
        k +
        'gameMode">' +
        mode +
        "</div>";
      document.getElementById("mapListFieldElement" + k).innerHTML +=
        '<div class="mapListFieldElementGameMode" id="mapListFieldElement' +
        k +
        'gameMode">' +
        mode +
        "</div>";
      if (k - 1 == currentMapIndex && k - 1 == nextMapIndex) {
        let map = generateMapName(args[0][n]);
        document.getElementById("mapRotationCurrentMap").innerHTML =
          map + ", " + mode;
        document.getElementById("mapRotationNextMap").innerHTML =
          map + ", " + mode;
        document.getElementById(
          "mapRotationFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap2"></div><div class="mapMarker next" id="nextMap2"></div>';
        document.getElementById("serverInfoMapBody").innerHTML = map;
        let mapUrl = generateMapUrl(args[0][n]);
        document.getElementById("serverInfoMapImg").style.backgroundImage =
          "url(fb://" + mapUrl + ")";
        document.getElementById("serverInfoMapRotationBody").innerHTML =
          '<p id="checkModeName"><span class="textMove">' +
          mode +
          "</span></p>";
        document.getElementById("serverInfoModeBody").innerHTML = mode;
        let modeImgUrl = generateModeUrl(args[0][i]);
        document.getElementById("serverInfoModeImg").style.backgroundImage =
          "url(fb://" + modeImgUrl + ")";
        document.getElementById(
          "mapListFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap"></div><div class="mapMarker next" id="nextMap"></div>';
      } else if (k - 1 == currentMapIndex) {
        let map = generateMapName(args[0][n]);
        document.getElementById("mapRotationCurrentMap").innerHTML =
          map + ", " + mode;
        document.getElementById(
          "mapRotationFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap2"></div>';
        document.getElementById("serverInfoMapBody").innerHTML = map;
        let mapUrl = generateMapUrl(args[0][n]);
        document.getElementById("serverInfoMapImg").style.backgroundImage =
          "url(fb://" + mapUrl + ")";
        document.getElementById("serverInfoMapRotationBody").innerHTML =
          '<p id="checkModeName"><span class="textMove">' +
          mode +
          "</span></p>";
        document.getElementById("serverInfoModeBody").innerHTML = mode;
        let modeImgUrl = generateModeUrl(args[0][i]);
        document.getElementById("serverInfoModeImg").style.backgroundImage =
          "url(fb://" + modeImgUrl + ")";
        document.getElementById(
          "mapListFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker current" id="currentMap"></div>';
      } else if (k - 1 == nextMapIndex) {
        document.getElementById("mapRotationNextMap").innerHTML =
          map + ", " + mode;
        document.getElementById(
          "mapRotationFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker next" id="nextMap2"></div>';
        document.getElementById(
          "mapListFieldElement" + k + "gameMode"
        ).innerHTML =
          '<span style="vertical-align: top;">' +
          mode +
          '</span><div class="mapMarker next" id="nextMap"></div>';
      }
    } else if (o == 3) {
      n = i - 2;
      let k = (n + 1) / 3;
      //document.getElementById("mapRotationFieldElement"+k).innerHTML += '<div class="mapRotationFieldElementRounds" id="mapRotationFieldElement'+k+'rounds">'+args[44][i]+'</div>';
      o = 0;
    }
    o++;
  }
  document.getElementById("currentMap3").src =
    "fb://UI/Art/Menu/Icons/map_current";
  document.getElementById("nextMap3").src = "fb://UI/Art/Menu/Icons/map_next";
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
  WebUI.Call("EnableKeyboard");
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
  WebUI.Call("ResetKeyboard");
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
  WebUI.Call("ResetKeyboard");
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

function biaEnsureQueuePanel() {
  if (document.getElementById("mapQueuePanel")) {
    return;
  }
  var anchor = document.getElementById("mapRotationNextMap");
  var host = null;
  var after = null;
  if (anchor && anchor.parentNode && anchor.parentNode.parentNode) {
    after = anchor.parentNode;
    host = after.parentNode;
  } else {
    host = document.getElementById("mapRotationSettings");
  }
  if (!host) {
    return;
  }
  var panel = document.createElement("div");
  panel.id = "mapQueuePanel";
  panel.innerHTML =
    '<div id="mapQueueHeader">Next Map Queue' +
    '<div id="mapQueueRandom" class="mapQueueToggle" onclick="biaToggleRandom()">' +
    '<div class="mapQueueToggleBox"></div>Random</div>' +
    '<div class="mapQueueBtn biaTipBtn" data-tip="Announce the next maps in chat to all players" onclick="biaAnnounceQueue()">!</div>' +
    '<div class="mapQueueBtn biaTipBtn" data-tip="Force the current queue head to load now (runs next round)" onclick="biaForceNextFromQueue()">&raquo;</div>' +
    '<div class="mapQueueBtn biaTipBtn" data-tip="Clear the entire map queue" onclick="biaClearQueue()">X</div>' +
    "</div>" +
    '<div id="mapQueueList"></div>';
  if (after && after.nextSibling) {
    host.insertBefore(panel, after.nextSibling);
  } else {
    host.appendChild(panel);
  }
  biaBindTooltips(panel);
  biaRenderQueue();
}

/* Hover >1.5s shows a floating tip under the button (Gameface has no title tooltips). */
var biaTipMouseX = 0;
var biaTipMouseY = 0;

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

function biaMoveInQueue(i, delta) {
  var to = i + delta;
  if (to < 0 || to >= biaMapQueue.length) {
    return;
  }
  var moved = biaMapQueue.splice(i, 1)[0];
  biaMapQueue.splice(to, 0, moved);
  biaRenderQueue();
  biaQueueSaveSoon();
}

function biaClearQueue() {
  biaMapQueue = [];
  biaLocalDirty = true;
  biaSuppressRestoreUntil = Date.now() + 5000;
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
  var toggle = document.getElementById("mapQueueRandom");
  if (toggle) {
    if (biaQueueRandom) {
      toggle.classList.add("checked");
    } else {
      toggle.classList.remove("checked");
    }
  }
  var list = document.getElementById("mapQueueList");
  if (!list) {
    return;
  }
  if (biaMapQueue.length === 0) {
    list.innerHTML =
      '<div id="mapQueueEmpty">Click maps in the list to queue them. Use Vote to pick next.</div>';
    return;
  }
  var html = "";
  for (var i = 0; i < biaMapQueue.length; i++) {
    var entry = biaMapQueue[i];
    if (!entry.mode && entry.index != null) {
      entry.mode = biaLookupModeForIndex(entry.index);
    }
    var modeText = entry.mode || "";
    html +=
      '<div class="mapQueueRow' + (i === 0 ? " mapQueueUpNext" : "") + '">' +
      '<div class="mapQueuePos">' + (i + 1) + "</div>" +
      '<div class="mapQueueName">' + entry.name + "</div>" +
      '<div class="mapQueueMode">' + modeText + "</div>" +
      '<div class="mapQueueBtn biaTipBtn" data-tip="Start a public vote to make this the next map" onclick="biaStartMapVote(' + i + ')">Vote</div>' +
      '<div class="mapQueueBtn" onclick="biaMoveInQueue(' + i + ', -1)">&#8593;</div>' +
      '<div class="mapQueueBtn" onclick="biaMoveInQueue(' + i + ', 1)">&#8595;</div>' +
      '<div class="mapQueueBtn" onclick="biaRemoveFromQueue(' + i + ')">X</div>' +
      "</div>";
  }
  list.innerHTML = html;
  biaBindTooltips(list);
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
  biaSuppressRestoreUntil = Date.now() + 5000;
  WebUI.Call(
    "DispatchEvent",
    "WebUI:SaveMapQueue",
    JSON.stringify({ random: biaQueueRandom, maps: payload })
  );
}

function restoreMapQueue(args) {
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
  biaSuppressRestoreUntil = Date.now() + 12000;
  if (biaSaveTimer !== null) {
    clearTimeout(biaSaveTimer);
  }
  // 10s after last change — resets if another edit comes in first
  biaSaveTimer = setTimeout(function () {
    biaSaveTimer = null;
    biaSaveQueueNow();
  }, 10000);
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
  biaMapVoteActive = true;
  isVoteInProgress = true;
  secondsLeft = args.seconds || 30;
  yesvotes = args.yes || 1;
  novotes = args.no || 0;
  showHideVotings = true;
  var label = args.name || "Map";
  if (args.mode) {
    label = label + " (" + args.mode + ")";
  }
  document.getElementById("votepopup").classList.add("shown");
  document.getElementById("votetitleleft").innerHTML =
    '<p class="biaMarquee"><span class="biaMarqueeInner">Next map: ' +
    label +
    "</span></p>";
  document.getElementById("votetitleleft").style.width = "80%";
  document.getElementById("votetitleright").innerHTML =
    "<p>" + secondsLeft + " sec</p>";
  // scroll long titles left after layout
  setTimeout(biaStartVoteMarquee, 50);
  document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
  document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
  document.getElementById("voteyes").style.fontWeight = "900";
  document.getElementById("voteno").style.fontWeight = null;
  // Click rows to vote (F8/F9 also handled in Client BiaManager)
  document.getElementById("voteyes").onclick = function () {
    if (biaMapVoteActive) {
      biaMapVoteYes();
    }
  };
  document.getElementById("voteno").onclick = function () {
    if (biaMapVoteActive) {
      biaMapVoteNo();
    }
  };
  if (biaMapVoteTimer !== null) {
    clearInterval(biaMapVoteTimer);
  }
  biaMapVoteTimer = setInterval(function () {
    if (!biaMapVoteActive) {
      clearInterval(biaMapVoteTimer);
      biaMapVoteTimer = null;
      return;
    }
    secondsLeft = secondsLeft - 1;
    if (secondsLeft < 0) {
      secondsLeft = 0;
    }
    document.getElementById("votetitleright").innerHTML =
      "<p>" + secondsLeft + " sec</p>";
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
  if (showHideVotings == true) {
    document.getElementById("countyesvotes").innerHTML = "" + yesvotes + " Y";
    document.getElementById("countnovotes").innerHTML = "" + novotes + " N";
  }
}

function endMapVote(args) {
  biaMapVoteActive = false;
  isVoteInProgress = false;
  biaStopVoteMarquee();
  if (biaMapVoteTimer !== null) {
    clearInterval(biaMapVoteTimer);
    biaMapVoteTimer = null;
  }
  var popup = document.getElementById("votepopup");
  if (popup) {
    popup.classList.remove("shown");
  }
  var yes = document.getElementById("voteyes");
  var no = document.getElementById("voteno");
  var left = document.getElementById("votetitleleft");
  if (yes) {
    yes.style.fontWeight = null;
    yes.onclick = null;
  }
  if (no) {
    no.style.fontWeight = null;
    no.onclick = null;
  }
  if (left) {
    left.style.width = null;
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
  if (document.getElementById("biaListPanel")) {
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
    "</div>" +
    '<div id="biaListBody"></div>';
  document.body.appendChild(panel);
}

function biaShowLists(mode) {
  biaEnsureListPanel();
  biaListMode = mode || biaListMode;
  document.getElementById("biaListPanel").classList.add("open");
  var bans = document.getElementById("biaTabBans");
  var admins = document.getElementById("biaTabAdmins");
  if (biaListMode === "bans") {
    bans.classList.add("active");
    admins.classList.remove("active");
    WebUI.Call("DispatchEvent", "WebUI:GetBanList");
  } else {
    admins.classList.add("active");
    bans.classList.remove("active");
    WebUI.Call("DispatchEvent", "WebUI:GetAdminList");
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
}

function biaRemoveAdmin(name) {
  WebUI.Call("DispatchEvent", "WebUI:RemoveAdmin", name);
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
  var body = document.getElementById("biaListBody");
  if (!body) {
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
      '<div class="biaListName">' + name + "</div>" +
      '<div class="biaListMeta">' + meta + "</div>" +
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
