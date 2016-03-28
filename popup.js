var tabId = null;
var currentData;

var prevBookmarkButton;
var nextBookmarkButton;
var pagifyFolder;
var divFolder;

function refresh() {
	chrome.browserAction.setIcon({
		path : {
			'19' : 'icon-gray.png'
		},
		tabId : tabId
	});
	withCurrentTab(function(tab) {
		tabId = tab.id;
		if (tab.url) {
			refreshButtons(tab.url);
		}
	});
}

function handler() {
	if (this.url) {
		var url = this.url;
		chrome.tabs.update(tabId, {
			url : url
		});
		refreshButtons(url);
	}
}

function refreshButtons(url) {
	chrome.bookmarks.getTree(function (tree) {
		var data = getInfo(url, tree);

		if (data) {
			currentData=data;
			chrome.browserAction.setIcon({
				path : {
					'19' : 'icon.png'
				},
				tabId : tabId
			});
		} else {
			currentData=null;
			chrome.browserAction.setIcon({
				path : {
					'19' : 'icon-gray.png'
				},
				tabId : tabId
			});
		}

		if (!divFolder || !prevBookmarkButton || !nextBookmarkButton)
			return;

		if (data && data.folder) {
			divFolder.innerText = data.folder.title;
			divFolder.setAttribute('title', data.path + ' : ' + data.index);
			pagifyFolder.style.display='';
		} else {
			divFolder.innerText = 'Not bookmarked';
			divFolder.setAttribute('title', 'Current page not found in bookmarks');
			pagifyFolder.style.display='none';
		}

		if (data && data.prev) {
			prevBookmarkButton.disabled = false;
			prevBookmarkButton.url = data.prev.url;
			prevBookmarkButton.setAttribute('title', (data.prev.title || '') + '\r\n' + data.prev.url + '\r\n(Ctrl-Shift-K)');
		} else {
			prevBookmarkButton.disabled = true;
			prevBookmarkButton.url = null;
			prevBookmarkButton.setAttribute('title', 'No previous bookmark');
		}

		if (data && data.next) {
			nextBookmarkButton.disabled = false;
			nextBookmarkButton.url = data.next.url;
			nextBookmarkButton.setAttribute('title', (data.next.title || '') + '\r\n' + data.next.url + '\r\n(Ctrl-Shift-L)');
		} else {
			nextBookmarkButton.disabled = true;
			nextBookmarkButton.url = null;
			nextBookmarkButton.setAttribute('title', 'No next bookmark');
		}
	});
}

function pagifyHandler() {
	chrome.runtime.getBackgroundPage(function(page) {
		var data=currentData;
		page.openPagify(data);
	});
}

document.addEventListener('DOMContentLoaded', function () {
	prevBookmarkButton = document.getElementById('prevBookmark');
	nextBookmarkButton = document.getElementById('nextBookmark');
	pagifyFolder = document.getElementById('pagifyFolder');
	divFolder = document.getElementById('divFolder');

	prevBookmarkButton.addEventListener('click', handler, false);
	nextBookmarkButton.addEventListener('click', handler, false);
	pagifyFolder.addEventListener('click', pagifyHandler, false);

	refresh();
}, false);
