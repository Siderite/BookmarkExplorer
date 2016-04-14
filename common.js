function withCurrentTab(callback) {
	chrome.tabs.query({
		'active' : true,
		'lastFocusedWindow' : true
	}, function (tabs) {
		var tab = tabs[0];
		if (!tab) return;
		callback(tab);
	});
};

function sameUrls(u1, u2) {
	u1 = (/^[^#]+/.exec(u1))[0].toLowerCase();
	u2 = (/^[^#]+/.exec(u2))[0].toLowerCase();
	return u1 == u2;
};

var notifications={};
function notify(text) {
	if (notifications[text]) {
		return;
	}
	chrome.notifications.create(null, {
	  type: "basic",
   	  title: "Siderite's Bookmark Explorer",
	  message: text,
	  iconUrl: "bigIcon.png"
	});
	notifications[text]=true;
	setTimeout(function() {
		notifications[text]=false;
	},5000);
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
					notify(r.current.title+' ('+r.current.url+' in '+itm.title+') is a duplicate bookmark! Using the one in '+result.folder.title);
				} else {
					result = r;
				}
			}
		}
		if (sameUrls(itm.url, url)) {
			var prev = null;
			for (var i=idx-1; i>=0; i--) {
				if (arr[i].url) {
					prev=arr[i];
					break;
				}
			}
			var next = null;
			for (var i=idx+1; i<arr.length; i++) {
				if (arr[i].url) {
					next=arr[i];
					break;
				}
			}
			result = {
				folder : tree,
				prev : prev,
				current : itm,
				next : next,
				index : idx,
				path : path
			};
		}
	});
	return result;
}
