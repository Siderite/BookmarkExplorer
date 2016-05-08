(function ($) {

	var global = this;
	var context = global.testContext&&global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome? global.testContext.chrome : global.chrome;
	var confirm=global.testContext &&global.testContext.confirm ? global.testContext.confirm : global.confirm;

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
				.prepend($('<img/>').attr('src', ApiWrapper.getIconForUrl(itm.url)))
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
						chk.click();
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

	$(function () {

		var api = new ApiWrapper(chrome);
		var container = $('html,body', context);
		var tree = $('#tree', context);
		var buttons = $('#buttons', context);
		var btnToggleAll = $('#btnToggleAll', context);
		var btnToggleBefore = $('#btnToggleBefore', context);
		var btnRemove = $('#btnRemove', context);
		var btnUndo = $('#btnUndo', context);

		api.onMessage(refresh);

		function refresh(data) {
			api.getData('lastDeletedBookmarks').then(function (bookmarks) {
				if (bookmarks) {
					btnUndo.text('Restore ' + bookmarks.length + ' bookmarks').show();
				} else {
					btnUndo.hide();
				}
			});

			currentData = data;
			tree.empty();
			btnRemove.hide();
			if (!data || !data.folder) {
				tree.append(createEmpty());
				btnToggleAll.hide();
				btnToggleBefore.hide();
				btnUndo.hide();
				return;
			}
			btnToggleAll.show();
			btnToggleBefore.show();
			var bottom = buttons.offset().top;
			tree.append(createTree(data.folder, 1));
			tree.find('input').click(refreshbtnRemove);
			var minTop = null;
			var maxTop = null;
			tree.find('a').each(function () {
				if (ApiWrapper.sameUrls($(this).attr('href'), data.current.url) < 2) return;

				var par = $(this).parent();
				par.addClass('selected');
				var ofs = par.offset();
				if (minTop === null)
					minTop = ofs.top;
				if (maxTop === null || ofs.top + 25 > maxTop)
					maxTop = ofs.top + 25;
			});
			if (minTop && maxTop) {
				var y = (minTop + maxTop) / 2;
				if (y >= bottom) {
					console.log('scrolling:',y - bottom / 2,y,bottom);
					container.animate({
						scrollTop : y - bottom / 2
					});
				}
			}
		}

		function refreshbtnRemove() {
			var ul = tree.find('>div>ul');
			var inputs = ul.find('input:checked');
			btnRemove.toggle(!!inputs.length);
		}

		btnToggleAll.click(function () {
			var ul = tree.find('>div>ul');
			var val = ul.find('>li>div>input:checked').length < ul.find('>li>div>input:not(:checked)').length;
			ul.find('>li>div>input').prop('checked', val);
			refreshbtnRemove();
		});
		btnToggleBefore.click(function () {
			var ul = tree.find('>div>ul');
			var index = ul.find('>li:has(div.selected)').index();
			var val = ul.find('>li>div>input:lt(' + index + '):checked').length < ul.find('>li>div>input:lt(' + index + '):not(:checked)').length;
			ul.find('>li>div>input:lt(' + index + ')').prop('checked', val);
			refreshbtnRemove();
		});
		btnRemove.click(function () {
			var ul = tree.find('>div>ul');
			var inputs = ul.find('input:checked');
			if (!inputs.length)
				return;
			if (!confirm('Are you sure you want to delete ' + inputs.length + ' bookmarks?'))
				return;
			var ids = []
			inputs.each(function () {
				var id =  $(this).val();
				if (id) {
					ids.push({
						id : id,
						input : this
					});
				}
			});
			api.getBookmarksByIds(ids.map(function (p) {
					return p.id;
				})).then(function (bookmarks) {
				api.setData('lastDeletedBookmarks', bookmarks).then(function () {
					btnUndo.text('Restore ' + bookmarks.length + ' bookmarks').show();
					ids.forEach(function (p) {
						api.removeBookmarksById([p.id]).then(function () {
							$(p.input).closest('li').remove();
						});
					});
					refreshbtnRemove();
				});
			});
		});

		btnUndo.click(function () {
			api.getData('lastDeletedBookmarks').then(function (bookmarks) {
				if (!confirm('Are you sure you want to restore ' + bookmarks.length + ' bookmarks?'))
					return;
				var parentIds = {};
				bookmarks.forEach(function (bm) {
					if (bm.parentId)
						parentIds[bm.parentId] = true;
				});
				parentIds = Object.keys(parentIds);
				api.getBookmarksByIds(parentIds).then(function (parentBookmarks) {
					if (!parentBookmarks || parentBookmarks.filter(function (bm) {
							return !!bm;
						}).length != parentIds.length) {
						api.notify('Parent bookmarks are missing, copying all in a new folder');
						api.getBookmarksBar().then(function (bar) {
							api.createBookmarks({
								title : 'Undeleted items',
								parentId : bar.id
							}).then(function (parent) {
								bookmarks.forEach(function (bm) {
									bm.parentId = parent.id;
								});
								api.createBookmarks(bookmarks);
								api.notify('Bookmarks restored');
								api.removeData('lastDeletedBookmarks').then(function () {
									btnUndo.hide();
									refresh(currentData);
								});
							});
						});
					} else {
						api.createBookmarks(bookmarks).then(function () {
							api.notify('Bookmarks restored');
							api.removeData('lastDeletedBookmarks').then(function () {
								btnUndo.hide();
								refresh(currentData);
							});
						});
					}
				});
			});
		});
		refresh();

	});

})(jQuery);