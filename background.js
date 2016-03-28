var tabId = null;
var currentData;
var menuItems = {};

function openPagify(data) {
	var url = chrome.extension.getURL('pagify.html');
	chrome.tabs.query({
		url:url+'*'
	},function(tabs) {
		var tab = tabs[0];
		data=data||currentData;
		if (!tab) {
			tab=chrome.tabs.create({ url: url },function(tab) {
				setTimeout(function() {
					chrome.tabs.sendMessage(tab.id,data);
				},500);
			});
		} else {
			chrome.tabs.update(tab.id, {selected: true},function() {
				setTimeout(function() {
					chrome.tabs.sendMessage(tab.id,data);
				},500);
			});
		}
	});
}

function refresh() {
	withCurrentTab(function(tab) {
		if (chrome.browserAction) {
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
			refreshPagify();
		}
	});
}

function refreshPagify() {
	var url = chrome.extension.getURL('pagify.html');
	chrome.tabs.query({
		url:url+'*'
	},function(tabs) {
		var tab = tabs[0];
		if (!tab) return;
		chrome.tabs.sendMessage(tab.id,currentData);
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

function navigate(command, tab) {
	if (!tab) {
		withCurrentTab(function(tab) {
			navigate(command, tab);
		});
		return;
	}
	switch (command) {
	case 'prevBookmark':
		if (!currentData || !currentData.prev)
			break;
		chrome.tabs.update(tab.id, {
			url : currentData.prev.url
		});
		break;
	case 'nextBookmark':
		if (!currentData || !currentData.next)
			break;
		chrome.tabs.update(tab.id, {
			url : currentData.next.url
		});
		break;
	}
}

chrome.tabs.onUpdated.addListener(refresh);
chrome.tabs.onCreated.addListener(refresh);
chrome.tabs.onRemoved.addListener(refresh);
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onActiveChanged.addListener(refresh);

chrome.bookmarks.onCreated.addListener(refresh);
chrome.bookmarks.onRemoved.addListener(refresh);
chrome.bookmarks.onChanged.addListener(refresh);
chrome.bookmarks.onMoved.addListener(refresh);
chrome.bookmarks.onChildrenReordered.addListener(refresh);
chrome.bookmarks.onImportEnded.addListener(refresh);


chrome.contextMenus.onClicked.addListener(function (info, tab) {
	navigate(info.menuItemId, tab);
});
chrome.commands.onCommand.addListener(function (command) {
	navigate(command, null);
});
refresh();