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

function navigate(command, tab, currentData, history) {
	if (command == 'show') {
		pagify();
		return;
	}
	if (!tab) {
		withCurrentTab(function (tab) {
			navigate(command, tab, currentData, history);
		});
		return;
	}
	if (typeof(currentData) == 'undefined') {
		chrome.bookmarks.getTree(function (tree) {
			var data = getInfo(tab.url, tree);
			navigate(command, tab, data, history);
		});
		return;
	}

	function checkHistory(key) {
		if (!history)
			return;
		var lastBookmarkedUrl = history[tab.id];
		if (!lastBookmarkedUrl)
			return;
		chrome.bookmarks.getTree(function (tree) {
			var data = getInfo(lastBookmarkedUrl, tree);
			if (!data || !data[key])
				return;
			if (confirm('Page not bookmarked. Continue from last bookmarked page opened in this tab?')) {
				chrome.tabs.update(tab.id, {
					url : data[key].url
				});
			}
		});
	}

	switch (command) {
	case 'prevBookmark':
		if (!currentData || !currentData.prev) {
			checkHistory('prev');
		} else {
			chrome.tabs.update(tab.id, {
				url : currentData.prev.url
			});
		}
		break;
	case 'nextBookmark':
		if (!currentData || !currentData.next)
			checkHistory('next');
		else {
			chrome.tabs.update(tab.id, {
				url : currentData.next.url
			});
		}
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

function getBookmarksById(ids, callback, tree) {
	if (!tree) {
		chrome.bookmarks.getTree(function (tree) {
			getBookmarksById(ids, callback, tree);
		});
		return;
	}
	var result = [];
	var arr = tree.children || tree;
	arr.forEach(function (itm) {
		if (itm.children) {
			getBookmarksById(ids, function (r) {
				result = result.concat(r);
			}, itm);
		}
		if (ids.includes(itm.id))
			result.push(itm);
	});
	callback(result);
}

function createBookmarks(bookmarks) {
	bookmarks.forEach(function (bm) {
		delete bm.dateAdded;
		delete bm.id;
		chrome.bookmarks.create(bm);
	});
}

function getBookmarkBarId(callback) {
	chrome.bookmarks.getTree(function (tree) {
		if (!tree || !tree.length || !tree[0].children || !tree[0].children.length) {
			notify('Error reading bookmarks!');
			return;
		}
		callback(tree[0].children[0].id);
	});
}

function getInfo(url, tree, path) {
	var result = null;

	function setResultOrNotify(r, itm) {
		if (result) {
			result.notifications.push(r.current.title + ' in ' + itm.title + ' (' + r.current.url + ') is a duplicate bookmark! Using the one in ' + result.folder.title + '@' + (result.index + 1));
		} else {
			result = r;
		}
	}

	if (tree.title) {
		if (path) {
			path += ' -> ' + tree.title;
		} else {
			path = tree.title;
		}
	}
	var arr = tree.children || tree;
	arr.forEach(function (itm, idx) {
		if (itm.children) {
			var r = getInfo(url, itm, path);
			if (r)
				setResultOrNotify(r, itm);
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
			setResultOrNotify({
				folder : tree,
				prev : prev,
				current : itm,
				next : next,
				index : idx,
				path : path,
				notifications : []
			}, itm);
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