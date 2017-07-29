(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
	var confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

	var currentData;

	$(function () {

		var list = $('#divList', context);
		var header = $('#spnTitle', context);
		var imgMenu = $('#imgMenu', context);
		var imgToggleAll = $('#imgToggleAll', context);
		var divStats = $('#divHeader .stats', context);
		var menu = $('#ulMenu', context);
		var liRestore = $('li[data-command=restore]', menu);
		var liClearAll = $('li[data-command=clearAll]', menu);
		var divFilter = $('#divFilter', context);

		divFilter.find('img').click(function () {
			divFilter.find('input').val('').trigger('change');
		});

		var api = new ApiWrapper(chrome);

		api.getBackgroundPage().then(function (bgPage) {

			var app = bgPage.app;

			list.listable({
				items : 'li>div:has(a)',
				filter : divFilter.find('input'),
				isEnabled : function () {
					return !menu.is(':visible');
				}
			}).on('filter', function () {
				refreshRestore();
			});

			imgToggleAll.click(function() { toggleAll(list); });

			function toggleAll(elem) {
				var inputs = elem.find('input[type=checkbox]:nothidden');
				var checked = inputs.filter(function () {
						return $(this).is(':checked');
					}).length / inputs.length >= 0.5;
				inputs.prop('checked', !checked);
				refreshRestore();
			}

			function createTree(arr, title, time) {
				var div = $('<div></div>').appendTo(list);
				var header = $('<div></div>')
					.addClass('treeHeader')
					.text(title || 'Unknown')
					.click(function () {
						toggleAll(ul);
					})
					.appendTo(div);
				if (time) header.attr('title','Deleted on '+new Date(time));
				var ul = $('<ul></ul>').appendTo(div);
				arr.forEach(function (child) {
					$('<li></li>')
					.append(createItem(child))
					.appendTo(ul);
				});
			}

			function refreshRestore() {
				liRestore.toggle(!!list.find('input[type=checkbox]:nothidden:checked').length);
			}

			function createItem(itm) {
				var elem = $('<div></div>');
				if (itm.url) {
					$('<a></a>')
					.text(itm.title || itm.url)
					.prepend($('<img/>').addClass('favicon').hideOnError().attr('src', ApiWrapper.getIconForUrl(itm.url)))
					.attr('href', itm.url || '#')
					.attr('target', '_blank')
					.appendTo(elem);
					var chk = $('<input />')
						.attr('type', 'checkbox')
						.val(itm.id)
						.attr('title', 'Mark for delete')
						.click(function () {
							$('div.current', list).removeClass('current');
							$(this).parents('div:first').addClass('current');
							refreshRestore();
						})
						.appendTo(elem);
					chk.data('bookmark', itm);
					elem.click(function (ev) {
						if (!chk.is(ev.target)) {
							chk.click();
						}
					});
				}
				return elem;
			}

			function executeMenuCommand(command) {
				switch (command) {
				case 'restore':
					if (restoreBookmarks()) {
						refresh();
					}
					break;
				case 'clearAll':
					if (confirm('Are you sure you want to permanently clear all deleted bookmarks?')) {
						api.removeAllDeletedBookmarks();
						refresh();
					}
					break;
				}
			}

			var doneTimeout;
			function notifyDone() {
				if (doneTimeout)
					clearTimeout(doneTimeout);
				doneTimeout = setTimeout(function () {
						api.notify('Bookmarks restored');
						refresh();
					}, 500);
			}

			function restoreBookmarks() {
				var items = list.find('input[type=checkbox]:nothidden:checked');
				if (!confirm('Are you sure you want to restore ' + items.length + ' bookmarks?'))
					return;

				var bookmarks = [];
				list.find('ul').each(function () {
					var ul = $(this);
					items = ul.find('input[type=checkbox]:nothidden:checked');
					bookmarks = bookmarks.concat(items.get().map(function (itm) {
								return $(itm).data('bookmark');
							}));
				});

				var newFolder = false;
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
						api.getBookmarksBar().then(function (bar) {
							if (!newFolder) {
								newFolder = true;
								api.notify('Some parent bookmarks are missing, restoring in new folder on the bookmarks bar.');
							}
							api.createBookmarks({
								title : 'Undeleted items',
								parentId : bar.id
							}).then(function (parent) {
								bookmarks.forEach(function (bm) {
									bm.parentId = parent.id;
								});
								var ids = bookmarks.map(function (bm) {
										return bm.id;
									});
								api.createBookmarks(bookmarks);
								api.removeDeletedBookmarksByIds(ids).then(notifyDone);
							});
						});
					} else {
						var ids = bookmarks.map(function (bm) {
								return bm.id;
							});
						api.createBookmarks(bookmarks).then(function () {
							api.removeDeletedBookmarksByIds(ids).then(notifyDone);
						});
					}
				});
				return true;
			}

			menu.contextMenu({
				anchor : imgMenu,
				executeCommand : executeMenuCommand
			});

			function refreshStats(stats) {
				divStats.text('('+stats.count+' items in '+(Math.round(stats.size/102.4)/10)+' KB)');
			}

			function refresh() {
				$(context).trigger('refresh');
				list.empty();
				var stats={
					count:0,
					size:0
				};
				api.getDeletedBookmarks().then(function (bookmarks) {
					if (!bookmarks || !bookmarks.length) {
						imgMenu.hide();
						imgToggleAll.hide();
						liRestore.hide();
						liClearAll.hide();
						header.text('No deleted bookmarks found');
						divFilter.hide();
						return;
					}
					imgMenu.show();
					imgToggleAll.show();
					liRestore.hide();
					liClearAll.show();
					divFilter.show();
					header.text('Deleted bookmarks');
					bookmarks.reverse().forEach(function (obj,idx) {
						var bms=obj.length?obj:obj.items;
						stats.count+=bms.length;
						api.getBookmarksByIds(bms.map(function (bm) {
							return bm.parentId;
						})).then(function (parents) {
							var title = parents.length ? parents[0].title : 'Unknown folder';
							createTree(bms, title, obj.time);
							if (idx==0) list.trigger('filter');
						});
					})
					api.getDeletedBookmarksSize().then(function(size) {
						stats.size=size;
						refreshStats(stats);
					});
				});
			}

			var refreshTimeout=null;
			if (api.onRemovedBookmark) {
				api.onRemovedBookmark(function() {
					if (refreshTimeout) clearTimeout(refreshTimeout);
					refreshTimeout=setTimeout(refresh,1000);
				});
			}
			refresh();

		});
	});

})(jQuery);