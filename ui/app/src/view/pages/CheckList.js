/**
 * Message list for the Check page.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class CheckList {
	
	#app = null;
	#docChecks = null;
	
	constructor(app) {
		this.#app = app;
		
		this.#docChecks = new DocumentChecks(this.#app);	
	}
	
	/**
	 * Process a check
	 */
	process(el, check) {
		el.empty();
		
		if (!check.messages) return;
		
		// Sort messages by document ID
		check.messages.sort(function(a, b) {
			return a.id < b.id; 
		});
		
		// Count errors types
		var numErrors = 0;
		var numWarnings = 0;
		var numInfo = 0;
		var numSuccess = 0;
		
		for(var m in check.messages) {
			var msg = check.messages[m];
			if (!msg.type) {
				numErrors++;
				continue;
			}
			switch(msg.type) {
				case 'E': numErrors++; break;
				case 'W': numWarnings++; break;
				case 'I': numInfo++; break;
				case 'S': numSuccess++; break;
				default: numErrors++; break;
			}
		}
		
		// Build messages table
		var rows = [];
		var d = this.#app.data;

		var that = this;
		for(var e in check.messages) {
			var msg = check.messages[e];
			
			var doc = d.getById(msg.id);
			var docName = doc ? d.getReadablePath(msg.id) : '';
			var docType = doc ? doc.type : '';
			
			rows.push(
				$('<tr data-id="' + (msg.id ? msg.id : '') + '"></tr>').append([
					// Type of message
					$('<td></td>').append(
						$('<span class="' + this.#getMessageTypeIcon(msg.type) + ' trashitemicon"></span>')
					),
					
					// Message text
					$('<td>' + (msg.message ? msg.message : '[No Message]') + '</td>'),
					
					// Document name
					$('<td>' + docName + '</td>'),
					
					// Document type
					$('<td>' + docType + '</td>'),
					
					// Document ID if any
					$('<td style="cursor: pointer;">' + (msg.id ? msg.id : '') + '</td>')
					.on('click', function(event) {
						event.stopPropagation();
						
						var data = $(this).parent().data();
						if (data && data.id) {
							that.#app.routing.call(data.id);
						}
					}),
					
					// Loaded?
					$('<td></td>').append(
						!msg.id ? null : $('<span class="' + (doc ? 'fa fa-check iconGreen' : 'fa fa-times iconRed') + '"></span>')
					),
					
					// Actions
					$('<td></td>').append(
						// Solve
						(!msg.solverReceipt && !msg.solver) ? null : $('<span data-index="' + e + '" data-id="' + msg.id + '" style="cursor: pointer;" class="fa fa-syringe versionButton" data-toggle="tooltip" title="Solve document..."></span>')
						.on('click', function(event) {
							event.stopPropagation();
							
							var id = $(this).data().id;
							if (!id) return;
							var index = $(this).data().index;
							
							var ms = check.messages[index];
							
							var stepsStr = '';
							var numSteps = 0;
							for(var m in ms.solverReceipt) {
								stepsStr += JSON.stringify(ms.solverReceipt[m]) + '\n';
								++numSteps;
							}
							if (ms.solver) {
								stepsStr += ms.solver.toString();
								++numSteps;
							}
							
							if (!confirm('Try to solve ' + id + ' (' + numSteps + ' steps)?\n\n' + stepsStr)) return;
							
							that.#docChecks.solveDocumentErrors([ms])
							.then(function(data) {
								return that.#app.actions.nav.requestTree();
							})
							.then(function(data) {
								that.#app.showAlert(data.message, 'I', data.messageThreadId);
							})
							.catch(function(err) {
								that.#app.showAlert(err.message, 'E', err.messageThreadId);
							});
						}),
						
						// Raw JSON View
						!msg.id ? null : $('<span data-id="' + msg.id + '" style="cursor: pointer;" class="fa fa-database versionButton" data-toggle="tooltip" title="Raw JSON..."></span>')
						.on('click', function(event) {
							event.stopPropagation();
							
							var id = $(this).data().id;
							if (!id) return;
							
							that.#app.routing.callRawView(id);
						}),
							
						// Delete
						!msg.id ? null : $('<span data-id="' + msg.id + '" style="cursor: pointer;" class="fa fa-trash versionButton" data-toggle="tooltip" title="Delete document..."></span>')
						.on('click', function(event) {
							event.stopPropagation();
							
							var id = $(this).data().id;
							if (!id) return;
							
							if (!confirm('Really delete document ' + id + ' from database?')) return;
							
							that.#app.documentAccess.deleteDbDocument(id)
							.then(function(data) {
								return that.#app.actions.nav.requestTree();
							})
							.then(function(data) {
								that.#app.showAlert(data.message, 'I', data.messageThreadId);
							})
							.catch(function(err) {
								that.#app.showAlert(err.message, 'E', err.messageThreadId);
							});
						})
					),
				])
			);
		}
		
		// Build table headers
		var checkListTable = $('<table class="table table-striped table-hover" />');		
		
		el.append(
			checkListTable.append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Type</th>'),
								$('<th scope="col">Message</th>'),
								$('<th scope="col">Document Name</th>'),
								$('<th scope="col">Doc. Type</th>'),
								$('<th scope="col">Document ID</th>'),
								$('<th scope="col">Displayed</th>'),
								$('<th scope="col">Actions</th>'),
							]
						)
					),
					$('<tbody/>').append(
						$('<tr></tr>').append([
							$('<td colspan="3"></td>').append(
								this.#createSelector('E', 'msgCheckError', numErrors),
								this.#createSelector('W', 'msgCheckWarning', numWarnings),
								this.#createSelector('I', 'msgCheckInfo', numInfo),
								this.#createSelector('S', 'msgCheckSuccess', numSuccess),
							),
						])
					).append(
						rows
					),
				]
			),
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
		Tools.makeTableSortable(checkListTable, {
			startIndex: 2,
			excludeColumns: [6]
		});
	}
	
	/**
	 * Creates a header msg type selector 
	 */
	#createSelector(msgType, className, num) {
		function handleSelector(event, el, className, num) {
			event.stopPropagation();
			$(el).find('.' + className).removeClass(className);
			
			if (num <= 0) return;
			
			// Row
			var els = $('.' + className).parent().parent();
			var hidden = (els.css('display') == 'none');
			if (els) els.css('display', hidden ? 'table-row' : 'none');
			
			// Display of number of messages of the type
			$(el).find('.checkListNumDisplay').html(!hidden ? ('(' + num + ')') : num);
			
			// Icon
			$(el).find('.trashitemicon').css('color', !hidden ? 'lightgrey' : '');
		}
		
		return $('<div class="checkMsgListHeader"></div>').append(
			$('<span class="' + this.getMessageTypeIcon(msgType) + ' trashitemicon"></span>'),
			$('<span class="checkListNumDisplay"></span>').html(num)
		)
		.on('click', function(event) {
			handleSelector(event, this, className, num);
		});
	}
	
	/**
	 * Get icon classes for the passed message type.
	 */
	#getMessageTypeIcon(type) {
		switch(type) {
		case 'S': return 'msgCheckSuccess fa fa-check-circle iconGreen';
		case 'I': return 'msgCheckInfo fa fa-info-circle iconBlue';
		case 'W': return 'msgCheckWarning fa fa-exclamation-circle iconOrange';
		case 'E': return 'msgCheckError fa fa-exclamation-circle iconRed';
		}
		return 'msgCheckError fa fa-question-circle iconRed';
	}
}