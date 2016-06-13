(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
	var api = new ApiWrapper(chrome);

	$(function () {

		var btnPrev = $('#btnPrev', context);
		var btnNext = $('#btnNext', context);
		var btnManage = $('#btnManage', context);
		var btnSettings = $('#divHeader img', context);
		var divFolder = $('#divFolder', context);

		api.getBackgroundPage().then(function (bgPage) {

			var app = bgPage.app;

			btnPrev.click(function () {
				app.execute('prevBookmark');
			});
			btnNext.click(function () {
				app.execute('nextBookmark');
			});
			btnManage.click(function () {
				app.execute('manage');
			});
			btnSettings.click(function () {
				app.execute('settings');
			});

			function refresh() {
				api.getCurrentTab().then(function (tab) {
					app.getInfo(tab.url).then(function (data) {
						if (data && data.folder) {
							divFolder.text(data.folder.title);
							divFolder.attr('title', data.path + ' : ' + data.index);
							btnManage.show();
						} else {
							divFolder.text('Not bookmarked');
							divFolder.attr('title', 'Current page not found in bookmarks');
						}

						if (data && data.prev) {
							btnPrev.prop('disabled', false);
							btnPrev.data('url', data.prev.url);
							btnPrev.attr('title', (data.prev.title || '') + '\r\n' + data.prev.url + '\r\n(Ctrl-Shift-K)');
						} else {
							btnPrev.prop('disabled', true);
							btnPrev.removeData('url')
							btnPrev.attr('title', 'No previous bookmark');
						}

						if (data && data.next) {
							btnNext.prop('disabled', false);
							btnNext.data('url', data.next.url);
							btnNext.attr('title', (data.next.title || '') + '\r\n' + data.next.url + '\r\n(Ctrl-Shift-L)');
						} else {
							btnNext.prop('disabled', true);
							btnNext.removeData('url');
							btnNext.attr('title', 'No next bookmark');
						}
					});
				});
			}

			refresh();
			api.onUpdatedTab(refresh);
		});
	});

})(jQuery);