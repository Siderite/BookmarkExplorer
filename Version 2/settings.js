(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
	var confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

	var api = new ApiWrapper(chrome);

	$(function () {
		var aShortcuts = $('#aShortcuts', context);
		var divShortcuts = $('#divShortcuts', context);
		var chkPrevNextContext = $('#chkPrevNextContext', context);
		var chkSkipButton = $('#chkSkipButton', context);
		var chkManageContext = $('#chkManageContext', context);
		var chkReadLaterContext = $('#chkReadLaterContext', context);
		var chkEnableBookmarkPage = $('#chkEnableBookmarkPage', context);
		var chkConfirmBookmarkPage = $('#chkConfirmBookmarkPage', context);
		var liReadLaterFolderName = $('#liReadLaterFolderName', context);
		var txtReadLaterPageTimeout = $('#txtReadLaterPageTimeout', context);
		var chkStoreAllDeletedBookmarks = $('#chkStoreAllDeletedBookmarks', context);
		var txtAutoClearDeleted = $('#txtAutoClearDeleted', context);
		var btnAddFolderName = $('#btnAddFolderName', context);
		var chkPreloadNext = $('#chkPreloadNext', context);
		var chkShowCurrentIndex = $('#chkShowCurrentIndex', context);
		var chkDuplicateNotifications = $('#chkDuplicateNotifications', context);
		var chkSkipPageNotBookmarkedOnNavigate = $('#chkSkipPageNotBookmarkedOnNavigate', context);

		api.getSettings().then(function (settings) {
			chkPrevNextContext
			.prop('checked', settings.prevNextContext)
			.click(function () {
				settings.prevNextContext = $(this).prop('checked');
				api.setSettings(settings);
			});
			chkSkipButton
			.prop('checked', !settings.hideSkipButton)
			.click(function () {
				settings.hideSkipButton = !$(this).prop('checked');
				api.setSettings(settings);
			});
			chkManageContext
			.prop('checked', settings.manageContext)
			.click(function () {
				settings.manageContext = $(this).prop('checked');
				api.setSettings(settings);
			});
			chkReadLaterContext
			.prop('checked', settings.readLaterContext)
			.click(function () {
				settings.readLaterContext = $(this).prop('checked');
				api.setSettings(settings);
			});
			chkEnableBookmarkPage
			.prop('checked', settings.enableBookmarkPage)
			.click(function () {
				settings.enableBookmarkPage = $(this).prop('checked');
				chkConfirmBookmarkPage.prop('disabled',!settings.enableBookmarkPage);
				api.setSettings(settings);
			});
			chkConfirmBookmarkPage
			.prop('disabled', !settings.enableBookmarkPage)
			.prop('checked', settings.confirmBookmarkPage)
			.click(function () {
				settings.confirmBookmarkPage = $(this).prop('checked');
				api.setSettings(settings);
			});
			chkShowCurrentIndex
			.prop('checked', settings.showCurrentIndex)
			.click(function () {
				settings.showCurrentIndex = $(this).prop('checked');
				api.setSettings(settings);
			});
			chkDuplicateNotifications
			.prop('checked', settings.showDuplicateNotifications)
			.click(function () {
				settings.showDuplicateNotifications = $(this).prop('checked');
				api.setSettings(settings);
			});
			chkSkipPageNotBookmarkedOnNavigate
			.prop('checked', settings.skipPageNotBookmarkedOnNavigate)
			.click(function () {
				settings.skipPageNotBookmarkedOnNavigate = $(this).prop('checked');
				api.setSettings(settings);
			});



			var n={};
			(settings.readLaterFolderName||'Read Later').split(/,/).forEach(function(name) {
				if (name) n[name]=true;
			});
			var names=Object.keys(n);

			liReadLaterFolderName
				.on('keyup paste', function () {
					var names=[];
					liReadLaterFolderName.find('input[type=text]').each(function() {
						var val=$(this).val().trim();
						if (val) names.push(val);
					});
					settings.readLaterFolderName=names.join(',');
					api.setSettings(settings);
				});


			var fInsertName=function(name) {
				$('<input type="text"/>')
					.val(name)
					.on('blur focusout',function() {
						var empty=[];
						var inputs = liReadLaterFolderName.find('input[type=text]');
						inputs.each(function() {
							var val=$(this).val().trim();
							if (!val) empty.push($(this));
						});
						if (empty.length&&empty.length==inputs.length) {
							empty.splice(0,1)[0].val('Read Later');
						}
						empty.forEach(function(input) { input.remove(); });
					})
					.insertBefore(btnAddFolderName);
			};
			names.forEach(fInsertName);
			btnAddFolderName.click(function() {
				fInsertName('');
			});

			txtReadLaterPageTimeout
			.val(settings.readLaterPageTimeout/1000)
			.on('keyup paste', function () {
				settings.readLaterPageTimeout = (+($(this).val())||10)*1000;
				api.setSettings(settings);
			});
			chkStoreAllDeletedBookmarks
			.prop('checked', settings.storeAllDeletedBookmarks)
			.click(function () {
				settings.storeAllDeletedBookmarks = $(this).prop('checked');
				api.setSettings(settings);
			});
			txtAutoClearDeleted
			.val(settings.daysAutoClearDeleted||'')
			.on('keyup paste', function () {
				var val= +($(this).val())||0;
				if (val<0) val=0;
				settings.daysAutoClearDeleted = val;
				api.setSettings(settings);
			});
			chkPreloadNext
			.prop('checked', settings.preloadNext)
			.click(function () {
				settings.preloadNext = $(this).prop('checked');
				api.setSettings(settings);
			});
		});

		aShortcuts.click(function (ev) {
			ev.preventDefault();
			divShortcuts.show();
		});

		$('#divTabs').tabs({
			active:1,
			heightStyle:'content'
		});
	});

})(jQuery);