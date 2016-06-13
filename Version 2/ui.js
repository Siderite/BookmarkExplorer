(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;

	$.fn.contextMenu = function (options) {
		var target = $(this);
		var anchor = $(options.anchor);

		function menuInit() {
			if (target.data('menu-initialized'))
				return;
			options.select = function (ev, ui) {
				var command = $(ui.item).data('command');
				if (command && typeof(options.executeCommand) == 'function') {
					options.executeCommand(command);
				}
				target.hide();
			};
			options.items = "> :not(.ui-widget-header)";
			var displays = [];
			target
			.show()
			.find('li').each(function () {
				displays.push(this.style.display);
				$(this).show();
			});
			target.menu(options)
			.position({
				my : "right top",
				at : "right bottom",
				of : anchor,
				collision : 'flip'
			});
			target
			.find('li').each(function (idx) {
				this.style.display = displays[idx];
			});

			$(context).click(function (ev) {
				if (target.has(ev.target).length)
					return;
				target.hide();
			});
			$(context).on('refresh focus focusout', function (ev) {
				target.hide();
			});

			target.data('menu-initialized', true);
		}

		function refreshMenuHeaders() {
			$('li.ui-widget-header', target).show().each(function () {
				var itm = $(this);
				var next = itm.next('li');
				while (next.length) {
					if (next.is('.ui-menu-item') && next.css('display') != 'none') {
						return;
					}
					if (next.is('.ui-widget-header')) {
						break;
					}
					next = next.next('li');
				}
				itm.hide();
			});
		}

		anchor.click(function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			if (target.is(':visible')) {
				target.hide();
			} else {
				menuInit();
				if (typeof(options.onOpen) == 'function') {
					options.onOpen(this);
				}
				refreshMenuHeaders();
				target.show();
			}
		});
		target.hide();

		return this;
	};

	$.fn.bringIntoView = function (options) {
		var target = $(this);
		options = options || {};
		var parent = $(options.parent || target.parent());

		var height = parent.height();
		var minTop = 100000000;
		var maxTop = -100000000;
		var maxHeight = 0;
		target.each(function () {
			var ofs = $(this).offset();
			if (minTop > ofs.top)
				minTop = ofs.top;
			var h = $(this).height();
			if (ofs.top + h > maxTop)
				maxTop = ofs.top + h;
			if (maxHeight < h)
				maxHeight = h;
		});

		var h = Math.min(maxTop - minTop, height - maxHeight);
		var y = minTop + h / 2;

		var top = parent.scrollTop() + y - parent.offset().top;
		if (top) {
			if (parent.queue().length > 1) {
				parent.clearQueue();
			}
			parent.animate({
				scrollTop : top - height / 2
			});
		}
		return this;
	}

	$.fn.listable = function (options) {
		var target = $(this);
		options = options || {};
		$(context).on('keydown', function (e) {
			if (typeof(options.isEnabled) == 'function' && !options.isEnabled()) {
				return;
			}
			var items = target.find(options.items);
			var index = -1;
			items.each(function (idx) {
				if ($(this).is('.current')) {
					index = idx;
					return false;
				}
			});
			if (index < 0) {
				if (typeof(options.findCurrent) == 'function') {
					index = options.findCurrent(items) || 0;
				} else {
					index = 0;
				}
			}
			switch (e.which) {
			case 38: //Up
				if (!$(e.target).is('body'))
					return;
				e.preventDefault();
				if (index - 1 >= 0) {
					items.eq(index).removeClass('current');
					index--;
					items.eq(index)
					.addClass('current')
					.bringIntoView({
						parent : target
					});
				}
				break;
			case 40: //Down
				if (!$(e.target).is('body'))
					return;
				e.preventDefault();
				if (index + 1 < items.length) {
					items.eq(index).removeClass('current');
					index++;
					items.eq(index)
					.addClass('current')
					.bringIntoView({
						parent : target
					});
				}
				break;
			case 32: //Space
				if (!$(e.target).is('body'))
					return;
				e.preventDefault();
				items.eq(index).click();
				break;
			}
		});
		return this;
	};

})(jQuery);