(function ($) {

	const global = this;
	const context = global.testContext && global.testContext.document || global.document;

	$.fn.contextMenu = function (options) {
		const target = $(this);
		const anchor = $(options.anchor);

		function menuInit() {
			if (target.data('menu-initialized'))
				return;
			options.select = (ev, ui) => {
				const command = $(ui.item).data('command');
				if (command && typeof(options.executeCommand) == 'function') {
					options.executeCommand(command);
				}
				target.hide();
			};
			options.items = "> :not(.ui-widget-header)";
			target.menu(options);

			$(context).click(ev => {
				if (target.has(ev.target).length)
					return;
				target.hide();
			});
			$(context).on('refresh focus focusout', ev => {
				target.hide();
			});

			target.data('menu-initialized', true);
		}

		function refreshMenuHeaders() {
			$('li.ui-widget-header', target)
				.show()
				.each(function () {
					const itm = $(this);
					let next = itm.next('li');
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
			target
				.position({
					my : "right top",
					at : "right bottom",
					of : anchor,
					collision : 'flip'
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
				positionMenu();
			}
		});
		$(global).on('resize',() => {
			positionMenu();
			refreshMenuHeaders();
		});
		target.hide();

		return this;
	};

	$.fn.bringIntoView = function (options) {
		const target = $(this);
		options = options || {};
		const parent = $(options.parent || target.parent());

		const height = parent.height();
		let minTop = 100000000;
		let maxTop = -100000000;
		let maxHeight = 0;
		target.each(function () {
			const ofs = $(this).offset();
			if (minTop > ofs.top)
				minTop = ofs.top;
			const h = $(this).height();
			if (ofs.top + h > maxTop)
				maxTop = ofs.top + h;
			if (maxHeight < h)
				maxHeight = h;
		});

		const h = Math.min(maxTop - minTop, height - maxHeight);
		const y = minTop + h / 2;

		const top = parent.scrollTop() + y - parent.offset().top;
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
		const target = $(this);
		options = options || {};
		let flt=null;
		if (options.filter) {
			flt=$(options.filter);
			if (!flt.length) {
				flt=null;
			} else {
				const f=e => {
					const items = target.find(options.items);
					const val=flt.val();
					if (val) {
						const splits=val.split(/\s+/).map(s => s.toLowerCase());
						items.each(function() {
							const itm=$(this);
							let content=itm.text().toLowerCase();
							itm.find('[href]').each(function() {
								content+=` ${$(this).attr('href')}`;
							});
							let visible=true;
							splits.forEach(s => {
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
		$(context).on('keydown', e => {
			if (typeof(options.isEnabled) == 'function' && !options.isEnabled()) {
				return;
			}
			const items = target.find(options.items).filter(function() { return $(this).is(':visible'); });
			let index = -1;
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
		nothidden(el) {
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
		const target = $(this);
		if (!target.is('img')) return this;
		options = options || {};

		target.on('error',function() {
			$(this).hide();
		});

		return this;
	}


})(jQuery);