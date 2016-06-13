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
		var chkManageContext = $('#chkManageContext', context);
		var chkReadLaterContext = $('#chkReadLaterContext', context);
		var txtReadLaterFolderName = $('#txtReadLaterFolderName', context);

		api.getSettings().then(function (settings) {
			chkPrevNextContext
			.prop('checked', settings.prevNextContext)
			.click(function () {
				settings.prevNextContext = $(this).prop('checked');
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
			txtReadLaterFolderName
			.val(settings.readLaterFolderName)
			.on('keyup paste', function () {
				settings.readLaterFolderName = $(this).val();
				api.setSettings(settings);
			});
		});

		aShortcuts.click(function (ev) {
			ev.preventDefault();
			divShortcuts.show();
		});
	});

})(jQuery);