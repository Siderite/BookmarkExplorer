(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
	var confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

	function createTree(itm, level, checkData) {
		var elem = $('<div></div>');
		if (itm.children) {
			elem.append($('<h' + level + '></h' + level + '>')
				.text(itm.title));
			if (level > 1) {
				elem.addClass('subtree');
			} else {
				elem.append($('<div id="divCounts"><span></span></div>'));
			}
			var ul = $('<ul></ul>').appendTo(elem);
			itm.children.forEach(function (child) {
				$('<li></li>')
				.append(createTree(child, level + 1, checkData))
				.appendTo(ul);
			});
		} else {
			if (itm.url && level == 2) {
				$('<a></a>')
				.text(itm.title || itm.url)
				.prepend($('<img/>').attr('src', ApiWrapper.getIconForUrl(itm.url)))
				.attr('href', itm.url || '#')
				.attr('target', '_blank')
				.appendTo(elem);
				var chk = $('<input />')
					.attr('type', 'checkbox')
					.val(itm.id)
					.attr('title', 'Mark for delete')
					.appendTo(elem);
				chk.data('id', itm.id);
				if (checkData && checkData[itm.id]) {
					chk.prop('checked', true);
				}
				elem.click(function (ev) {
					if (!chk.is(ev.target)) {
						chk.click();
					}
				});
			}
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
		var container = $('body', context);
		var tree = $('#tree', context);
		var buttons = $('#buttons', context);
		var btnToggleAll = $('#btnToggleAll', context);
		var btnToggleBefore = $('#btnToggleBefore', context);
		var btnRemove = $('#btnRemove', context);
		var btnUndo = $('#btnUndo', context);

		$(context).on('keydown', function (e) {
			switch (e.which) {
			case 38: //Up
			case 40: //Down
			case 32: //Space
				e.preventDefault();
				break;
			}
			
		});

		$(context).on('keyup', function (e) {
			var ul = tree.find('>div>ul');
			var index = ul.find('>li:has(div.current)').index();
			if (index < 0) index=0;
			switch (e.which) {
			case 38: //Up
				if (index - 1 >= 0) {
					ul.find('>li>div').eq(index).removeClass('current');
					index--;
					ul.find('>li>div').eq(index).addClass('current');
					bringCurrentIntoView();
				}
				break;
			case 40: //Down
				var total = ul.find('>li').length;
				if (index + 1 < total) {
					ul.find('>li>div').eq(index).removeClass('current');
					index++;
					ul.find('>li>div').eq(index).addClass('current');
					bringCurrentIntoView();
				}
				break;
			case 32: //Space
				ul.find('>li').eq(index).find('input[type=checkbox]').click();
				break;
			}
			
		});

		api.onMessage(refresh);

		function refresh(data) {
			api.getData('lastDeletedBookmarks').then(function (bookmarks) {
				if (bookmarks) {
					btnUndo.text('Restore ' + bookmarks.length + ' bookmarks').show();
				} else {
					btnUndo.hide();
				}
			});

			var checkData = {};
			tree.find('input[type=checkbox]').each(function () {
				var id = $(this).data('id');
				if (id) {
					var checked = $(this).prop('checked');
					checkData[id] = checked;
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
			tree.append(createTree(data.folder, 1, checkData));
			tree.find('input[type=checkbox]').click(refreshbtnRemove);
			tree.find('a').each(function () {
				if (ApiWrapper.sameUrls($(this).attr('href'), data.current.url) < 2)
					return;

				var par = $(this).parent();
				par.addClass('selected');
			});
			bringSelectedIntoView();
			refreshCounts();
		}

		function bringSelectedIntoView() {
			var bottom = $(window).height()-buttons.height();
			var minTop = null;
			var maxTop = null;
			tree.find('div.selected').each(function () {
				var ofs = $(this).offset();
				if (minTop === null)
					minTop = ofs.top;
				if (maxTop === null || ofs.top + 25 > maxTop)
					maxTop = ofs.top + 25;
			});
			if (minTop && maxTop) {
				var y = (minTop + maxTop) / 2;
				if (y >= bottom) {
					container.animate({
						scrollTop : y - bottom / 2
					});
				}
			}
		}

		function bringCurrentIntoView() {
			var bottom = $(window).height()-buttons.height();
			var current = tree.find('div.current');
			var minTop=current.offset().top;
			var maxTop=minTop+current.height();
			if (minTop && maxTop) {
				var y = (minTop + maxTop) / 2;
				container.clearQueue().animate({
					scrollTop : y - bottom / 2
				});
			}
		}

		function refreshbtnRemove() {
			var ul = tree.find('>div>ul');
			var checkedInputs = ul.find('input:checked');
			btnRemove.toggle(!!checkedInputs.length);
			refreshCounts();
		}

		function refreshCounts() {
			var ul = tree.find('>div>ul');
			var inputs = ul.find('input');
			var checkedInputs = ul.find('input:checked');
			tree.find('#divCounts span').text(inputs.length
				 ? checkedInputs.length + '/' + inputs.length
				 : '');
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
				var id = $(this).val();
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