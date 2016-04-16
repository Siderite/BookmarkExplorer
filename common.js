function withCurrentTab(callback) {
	chrome.tabs.query({
		'active' : true,
		'lastFocusedWindow' : true
	}, function (tabs) {
		var tab = tabs[0];
		if (!tab)
			return;
		callback(tab);
	});
};

function navigate(command, tab, currentData) {
	if (command == 'show') {
		pagify();
		return;
	}
	if (!tab) {
		withCurrentTab(function (tab) {
			navigate(command, tab, currentData);
		});
		return;
	}
	if (typeof(currentData) == 'undefined') {
		chrome.bookmarks.getTree(function (tree) {
			var data = getInfo(tab.url, tree);
			navigate(command, tab, data);
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

function sameUrls(u1, u2) {
	u1 = (/^[^#]+/.exec(u1))[0].toLowerCase();
	u2 = (/^[^#]+/.exec(u2))[0].toLowerCase();
	return u1 == u2;
};

function notify(text) {
	chrome.notifications.create(null, {
		type : "basic",
		title : "Siderite's Bookmark Explorer",
		message : text,
		iconUrl : "bigIcon.png"
	});
}

function getInfo(url, tree, path) {
	if (tree.title) {
		if (path) {
			path += ' -> ' + tree.title;
		} else {
			path = tree.title;
		}
	}
	var result = null;
	var arr = tree.children || tree;
	arr.forEach(function (itm, idx) {
		if (itm.children) {
			var r = getInfo(url, itm, path);
			if (r) {
				if (result) {
					result.notifications.push(r.current.title + ' in ' + itm.title + ' (' + r.current.url + ') is a duplicate bookmark! Using the one in ' + result.folder.title);
				} else {
					result = r;
				}
			}
		}
		if (sameUrls(itm.url, url)) {
			var prev = null;
			for (var i = idx - 1; i >= 0; i--) {
				if (arr[i].url) {
					prev = arr[i];
					break;
				}
			}
			var next = null;
			for (var i = idx + 1; i < arr.length; i++) {
				if (arr[i].url) {
					next = arr[i];
					break;
				}
			}
			result = {
				folder : tree,
				prev : prev,
				current : itm,
				next : next,
				index : idx,
				path : path,
				notifications : []
			};
		}
	});
	return result;
}

function pagify() {
	chrome.runtime.getBackgroundPage(function (page) {
		var data = currentData;
		page.openPagify(data);
	});
}