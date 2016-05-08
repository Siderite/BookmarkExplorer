var tabId = null;
var currentData;
var menuItems = {};

function openPagify(data) {
	var url = chrome.extension.getURL('pagify.html');
	chrome.tabs.query({
		url : url + '*'
	}, function (tabs) {
		var tab = tabs[0];
		data = data || currentData;
		if (!tab) {
			tab = chrome.tabs.create({
					url : url
				}, function (tab) {
					setTimeout(function () {
						chrome.tabs.sendMessage(tab.id, data);
					}, 500);
				});
		} else {
			chrome.tabs.update(tab.id, {
				selected : true
			}, function () {
				setTimeout(function () {
					chrome.tabs.sendMessage(tab.id, data);
				}, 500);
			});
		}
	});
}

function refresh(fromremove) {
	withCurrentTab(function (tab) {
		if (!fromremove && tabId && chrome.browserAction) {
			chrome.browserAction.setIcon({
				path : {
					'19' : 'icon-gray.png'
				},
				tabId : tabId
			});
		}
		tabId = tab.id;
		if (tab.url) {
			refreshIconAndMenu(tab.url);
			refreshPagify(tab.url);
		}
	});
}

function refreshPagify(url) {
	var pagifyurl = chrome.extension.getURL('pagify.html');
	if (url==pagifyurl) return;
	chrome.tabs.query({
		url : pagifyurl + '*',
		
	}, function (tabs) {
		var tab = tabs[0];
		if (!tab)
			return;
		chrome.tabs.sendMessage(tab.id, currentData||{});
	});
}

function refreshIconAndMenu(url) {
	chrome.bookmarks.getTree(function (tree) {
		var data = getInfo(url, tree);

		if (menuItems.prev) {
			menuItems.prev = null;
			chrome.contextMenus.remove("prevBookmark");
		}
		if (menuItems.next) {
			menuItems.next = null;
			chrome.contextMenus.remove("nextBookmark");
		}
		if (menuItems.show) {
			menuItems.show = null;
			chrome.contextMenus.remove("show");
		}
		if (data) {
			currentData = data;
			if (chrome.browserAction) {
				chrome.browserAction.setIcon({
					path : {
						'19' : 'icon.png'
					},
					tabId : tabId
				});
			}
			menuItems.show = chrome.contextMenus.create({
					"id" : "show",
					"title" : "Manage bookmark folder",
					"contexts" : ["page"]
				});
			if (data.prev) {
				menuItems.prev = chrome.contextMenus.create({
						"id" : "prevBookmark",
						"title" : "Navigate to previous bookmark (Ctrl-Shift-K)",
						"contexts" : ["page"]
					});
			}
			if (data.next) {
				menuItems.next = chrome.contextMenus.create({
						"id" : "nextBookmark",
						"title" : "Navigate to next bookmark (Ctrl-Shift-L)",
						"contexts" : ["page"]
					});
			}
		} else {
			currentData = null;
			if (chrome.browserAction) {
				chrome.browserAction.setIcon({
					path : {
						'19' : 'icon-gray.png'
					},
					tabId : tabId
				});
			}
		}
	});
}

var history={};

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	refresh();
	if (changeInfo && changeInfo.status == 'complete') {
		if (currentData && currentData.current && tab.url==currentData.current.url) {
			currentData.notifications.forEach(notify);
		}
		if (currentData) {
			history[tabId]=tab.url;
		}
	}
});
chrome.tabs.onCreated.addListener(refresh);
chrome.tabs.onRemoved.addListener(function () {
	refresh(true);
});
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onActiveChanged.addListener(refresh);

chrome.bookmarks.onCreated.addListener(refresh);
chrome.bookmarks.onRemoved.addListener(refresh);
chrome.bookmarks.onChanged.addListener(refresh);
chrome.bookmarks.onMoved.addListener(refresh);
chrome.bookmarks.onChildrenReordered.addListener(refresh);
chrome.bookmarks.onImportEnded.addListener(refresh);

chrome.contextMenus.onClicked.addListener(function (info, tab) {
	navigate(info.menuItemId, tab, currentData, history);
});
chrome.commands.onCommand.addListener(function (command) {
	navigate(command, null, currentData, history);
});
refresh();