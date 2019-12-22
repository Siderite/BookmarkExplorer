function createTree(itm, level) {
	var elem = $('<div></div>');
	if (itm.children) {
		if (level > 1)
			elem.addClass('subtree');
		elem.append($('<h' + level + '></h' + level + '>').text(itm.title));
		var ul = $('<ul></ul>').appendTo(elem);
		itm.children.forEach(function (child) {
			$('<li></li>')
			.append(createTree(child, level + 1))
			.appendTo(ul);
		});
	} else
		if (itm.url) {
			$('<a></a>')
			.text(itm.title || itm.url)
			.prepend($('<img/>').attr('src', 'chrome://favicon/' + itm.url))
			.attr('href', itm.url || '#')
			.attr('target', '_blank')
			.appendTo(elem);
			var chk = $('<input />')
				.attr('type', 'checkbox')
				.val(itm.id)
				.attr('title', 'Mark for delete');
			if (level == 2)
				chk.appendTo(elem);
			elem.click(function (ev) {
				if (!chk.is(ev.target)) {
					chk.prop('checked', !chk.prop('checked'));
				}
			});
		}
	return elem;
}

function createEmpty() {
	var elem = $('<div></div>');
	elem.append($('<h1></h1>').text('Bookmark for the URL not found'));
	$('<h4></h4>').text('Move to a tab that has been bookmarked to populate this page.').appendTo(elem);
	return elem;
}

var currentData;
function refresh(data) {
	currentData = data;
	var tree = $('#tree').empty();
	if (!data || !data.folder) {
		tree.append(createEmpty());
		$('#btnToggleAll,#btnToggleBefore,#btnRemove').hide();
		return;
	}
	$('#btnToggleAll,#btnToggleBefore,#btnRemove').show();
	var bottom = $('#buttons').offset().top;
	tree.append(createTree(data.folder, 1));
	var minTop = null;
	var maxTop = null;
	$('a', '#tree').each(function () {
		if (sameUrls($(this).attr('href'), data.current.url)) {
			var par = $(this).parent();
			par.addClass('selected');
			var ofs = par.offset();
			if (minTop === null)
				minTop = ofs.top;
			if (maxTop === null || ofs.top + par.height() > maxTop)
				maxTop = ofs.top + par.height();
		}
	});
	if (minTop && maxTop) {
		var y = (minTop + maxTop) / 2;
		if (y >= bottom) {
			$('html,body').animate({
				scrollTop : y - bottom / 2
			});
		}
	}
}

$(function () {
	chrome.runtime.onMessage.addListener(refresh);

	$('#btnToggleAll').click(function () {
		var val = $('#tree>div>ul>li>div>input:checked').length < $('#tree>div>ul>li>div>input:not(:checked)').length;
		$('#tree>div>ul>li>div>input').prop('checked', val);
	});
	$('#btnToggleBefore').click(function () {
		var index = $('#tree>div>ul>li:has(div.selected)').index();
		var val = $('#tree>div>ul>li>div>input:lt(' + index + '):checked').length < $('#tree>div>ul>li>div>input:lt(' + index + '):not(:checked)').length;
		$('#tree>div>ul>li>div>input:lt(' + index + ')').prop('checked', val);
	});
	$('#btnRemove').click(function () {
		var inputs = $('input:checked');
		if (!inputs.length)
			return;
		if (!confirm('Are you sure you want to delete ' + inputs.length + ' bookmarks?'))
			return;
		var ids = []
		inputs.each(function () {
			var id =  + ($(this).val());
			if (id) {
				ids.push({
					id : id + '',
					input : this
				});
			}
		});
		chrome.bookmarks.get(ids.map(function (p) {
				return p.id;
			}), function (bookmarks) {
			chrome.storage.local.set({
				'lastDeletedBookmarks' : bookmarks
			}, function () {
				if (chrome.runtime.lastError) {
					notify('Error saving bookmarks before delete: ' + chrome.runtime.lastError.message);
				} else {
					$('#btnUndo').text('Restore ' + bookmarks.length + ' bookmarks').show();
					ids.forEach(function (p) {
						chrome.bookmarks.remove(p.id, function () {
							$(p.input).closest('li').remove();
						});
					});
				}
			});
		});
	});
	chrome.storage.local.get('lastDeletedBookmarks', function (data) {
		if (data && data.lastDeletedBookmarks) {
			$('#btnUndo').text('Restore ' + data.lastDeletedBookmarks.length + ' bookmarks').show();
		} else {
			$('#btnUndo').hide();
		}
	});
	$('#btnUndo').click(function () {
		chrome.storage.local.get('lastDeletedBookmarks', function (data) {
			var bookmarks = data.lastDeletedBookmarks;
			if (!confirm('Are you sure you want to restore ' + bookmarks.length + ' bookmarks?'))
				return;
			var parentIds = {};
			bookmarks.forEach(function (bm) {
				if (bm.parentId)
					parentIds[bm.parentId] = true;
			});
			parentIds = Object.keys(parentIds);
			getBookmarksById(parentIds, function (parentBookmarks) {
				if (!parentBookmarks || parentBookmarks.filter(function (bm) {
						return !!bm;
					}).length != parentIds.length) {
					notify('Parent bookmarks are missing, copying all in a new folder');
					getBookmarkBarId(function (barId) {
						chrome.bookmarks.create({
							title : 'Undeleted items',
							parentId : barId
						}, function (parent) {
							bookmarks.forEach(function (bm) {
								bm.parentId = parent.id;
							});
							createBookmarks(bookmarks);
							notify('Bookmarks restored');
							chrome.storage.local.remove('lastDeletedBookmarks', function () {
								$('#btnUndo').hide();
								refresh(currentData);
							});
						});
					});
				} else {
					createBookmarks(bookmarks);
					notify('Bookmarks restored');
					chrome.storage.local.remove('lastDeletedBookmarks', function () {
						$('#btnUndo').hide();
						refresh(currentData);
					});
				}
			});
		});
	});
	refresh();
});