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
			target.menu(options);
			positionMenu();

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

		function positionMenu() {
			var visible=target.is(':visible');
			var displays = [];
			target
			.show()
			.find('li').each(function () {
				displays.push(this.style.display);
				$(this).show();
			});
			target
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
			target.toggle(visible);
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
		$(global).on('resize',function() {
			positionMenu();
			refreshMenuHeaders();
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
		var flt=null;
		if (options.filter) {
			flt=$(options.filter);
			if (!flt.length) {
				flt=null;
			} else {
				var f=function (e) {
					var items = target.find(options.items);
					var val=flt.val();
					if (val) {
						var splits=val.split(/\s+/).map(function(s) { return s.toLowerCase(); });
						items.each(function() {
							var itm=$(this);
							var content=itm.text().toLowerCase();
							itm.find('[href]').each(function() {
								content+=' '+$(this).attr('href');
							});
							var visible=true;
							splits.forEach(function(s) {
								visible=visible&&content.includes(s);
							});
							itm.toggle(visible);
						});
					} else {
						items.show();
					}
					if (e.type!='filter') {
						target.trigger('filter');
					}
				};
				flt.on('keyup paste change', f);
				target.on('filter',f);
			}
		}
		$(context).on('keydown', function (e) {
			if (typeof(options.isEnabled) == 'function' && !options.isEnabled()) {
				return;
			}
			var items = target.find(options.items).filter(function() { return $(this).is(':visible'); });
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
				if (!$(e.target).is('body')&&!(flt&&$(e.target).is(flt)))
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
				if (!$(e.target).is('body')&&!(flt&&$(e.target).is(flt)))
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
			case 33: //PageUp
				if (!$(e.target).is('body')&&!(flt&&$(e.target).is(flt)))
					return;
				e.preventDefault();
				items.eq(index).removeClass('current');
				index=Math.max(0,index-20);
				items.eq(index)
					.addClass('current')
					.bringIntoView({
						parent : target
					});
				break;
			case 34: //PageDown
				if (!$(e.target).is('body')&&!(flt&&$(e.target).is(flt)))
					return;
				e.preventDefault();
				items.eq(index).removeClass('current');
				index=Math.min(items.length-1,index+20);
				items.eq(index)
					.addClass('current')
					.bringIntoView({
						parent : target
					});
				break;
			case 36: //Home
				if (!$(e.target).is('body')&&!(flt&&$(e.target).is(flt)))
					return;
				e.preventDefault();
				items.eq(index).removeClass('current');
				index=0;
				items.eq(index)
				.addClass('current')
				.bringIntoView({
					parent : target
				});
				break;
			case 35: //End
				if (!$(e.target).is('body')&&!(flt&&$(e.target).is(flt)))
					return;
				e.preventDefault();
				items.eq(index).removeClass('current');
				index=items.length-1;
				items.eq(index)
				.addClass('current')
				.bringIntoView({
					parent : target
				});
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

	$.extend($.expr[':'], {
		nothidden : function (el) {
			el=$(el);
			while (el.length) {
				if (el[0].ownerDocument===null) break;
				if (el.css('display')=='none') return false;
				el=el.parent();
			}
			return true;
		}
	});

	$.fn.hideOnError = function (options) {
		var target = $(this);
		if (!target.is('img')) return this;
		options = options || {};

		target.on('error',function() {
			$(this).hide();
		});

		return this;
	}


})(jQuery);