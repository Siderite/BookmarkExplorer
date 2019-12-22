(function($) {
	$.fn.menu=function(options) {
		$('li[data-command]',this).click(function() {
			options.select(null,{ item:$(this) });
		});
		return this;
	};
})(jQuery);