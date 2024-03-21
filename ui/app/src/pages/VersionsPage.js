/**
 * Handles the TinyMCE history view.
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
class VersionsPage extends Page {
	
	#current = null;
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current ? this.#current : null;
	}
	
	/**
	 * Unload instance
	 */
	async unload() {
		this.#current = null;
	}
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	async load(doc) {
		var that = this;
		this.#current = doc;
		
		this._tab.setStatusText("History of " + doc.name);
		
		// Change log
		var hist = Document.getChangeLog(doc) ? Document.getChangeLog(doc) : [];
		
		// Build rows of changes
		var chgRows = new Array();
		for(var i=hist.length-1; i>=0; --i) {
			var chg = hist[i];
			
			chgRows.push(
				$('<tr>').append([
					$('<td class="tableAlignMiddle" data-ts="' + chg.ts + '">' + new Date(chg.ts).toLocaleString() + '</td>'),
					$('<td class="tableAlignMiddle" ></td>').html(chg.type),
					$('<td class="tableAlignMiddle" ></td>').html(chg.user),
					$('<td class="tableAlignMiddle" ></td>').html(JSON.stringify(chg.data)),
				])
			);
		}
		
		// Versions: Add timestamps to the attachments, derived from their file names
		var attachments = [];
		var versionsSize = 0;
		var atts = Document.getAttachments(doc);
		
		for (var prop in atts) {
		    if (Object.prototype.hasOwnProperty.call(atts, prop)) {
		    	attachments.push({
		    		name: prop,
		    		size: atts[prop].length,
		    		timestamp: parseInt(prop.substring("version_".length)) 
		    	});
		    	versionsSize += atts[prop].length;
		    }
		}

		// Sort version data
		attachments.sort(function(a, b){return b.timestamp - a.timestamp});

		// Build rows of versions
		var rows = new Array();
		for(var i in attachments) {
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="View Version" class="fa fa-eye versionButton" data-id="' + attachments[i].name + '"/>')
					.on('click', function(e) {
						const id = $(this).data().id;
						const cid = that.#current._id;
						
						if (Config.versionRestoreImmediately && Document.canRestore(cid)) {
							that._app.actions.history.requestVersion(cid, id, true);
						} else {
							that._app.routing.call("history/" + cid + "/" + id);
						}
					}),
					$('<div data-toggle="tooltip" title="Delete Version" class="fa fa-trash versionButton" data-id="vref_' + attachments[i].name + '"/>')
					.on('click', function(e) {
						const id = $(this).data().id;
						const cid = that.#current._id;
						
						if (!confirm("Do you really want to delete " + id + "?")) {
							that._app.showAlert("Action cancelled.", "I");
							return;
						}
						
						that._app.actions.version.deleteVersion(cid, id)
						.then(function(data) {
							if (data.message) that._app.showAlert(data.message, 'S', data.messageThreadId);
						})
						.catch(function(err) {
							that._app.showAlert('Error deleting version: ' + err.message, 'E', err.messageThreadId);
						});
					})
				]
			);
		
			rows.push(
				$('<tr>').append(
					[
						$('<td>' + attachments[i].name + '</td>'),
						$('<td/>').append(butts),
						$('<td data-ts="' + attachments[i].timestamp + '">' + new Date(attachments[i].timestamp).toLocaleString() + ' (' + Tools.getTimeSinceDisplay(attachments[i].timestamp) + ')</td>'),
						$('<td data-size="' + attachments[i].size + '">' + Tools.convertFilesize(attachments[i].size) + '</td>'),
					]					
				)
			);
		}
		
		// Size strings
		var histSizeStr = Tools.convertFilesize(JSON.stringify(hist).length);
		var versionSizeStr = Tools.convertFilesize(versionsSize);
		var bgImageSizeStr = doc.backImage ? Tools.convertFilesize(JSON.stringify(doc.backImage).length) : 'No image';
		
		var versionsTable = $('<table class="table table-striped table-hover" />');
		var changeLogTable = $('<table class="table table-striped table-hover" />');
		
		// Table buildup
		this._tab.getContainer().append(
			$('<div class="h4 contentHeadline"></div>').append(
				$('<div class="contentHeadlineText">Version History (' + rows.length + ' Entries, ' + versionSizeStr + ')</div>'),
				
				$('<div type="button" data-toggle="tooltip" title="Delete Version History" class="contentHeadlineButton fa fa-trash"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.#deleteHistory();
				})
			),
			versionsTable.append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Name</th>'),
								$('<th scope="col">Actions</th>'),
								$('<th scope="col">Created At</th>'),
								$('<th scope="col">Size</th>'),
							]
						)
					),
					$('<tbody/>').append(rows),
				]
			),
			
			$('<hr>'), ///////////////////////////////////////////////////////////////////////////////////////////////////////
			
			$('<div class="h4 contentHeadline"></div>').append(
				$('<div class="contentHeadlineText">Change Log (' + chgRows.length + ' Entries, ' + histSizeStr + ')</div>'),
				$('<div type="button" data-toggle="tooltip" title="Delete Change Log" class="contentHeadlineButton fa fa-trash"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.#deleteChangeLog();
				})
			),
			changeLogTable.append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Timestamp</th>'),
								$('<th scope="col">Type</th>'),
								$('<th scope="col">Changed by</th>'),
								$('<th scope="col">Change Data</th>'),
							]
						)
					),
					$('<tbody/>').append(chgRows),
				]
			),
				
			$('<hr>'), ///////////////////////////////////////////////////////////////////////////////////////////////////////
			
			$('<div class="h4 contentHeadline"></div>').append(
				$('<div class="contentHeadlineText">Background image size: ' + bgImageSizeStr + '</div>')
			),
			
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
		Tools.makeTableSortable(versionsTable, {
			excludeColumns: [1],
			sortData: [
				{
					colIndex: 2,
					getValue: function(td) {
						return $(td).data().ts;
					}
				},
				{
					colIndex: 3,
					getValue: function(td) {
						return $(td).data().size;
					}
				}
			]
		});
		
		Tools.makeTableSortable(changeLogTable, {
			sortData: [
				{
					colIndex: 0,
					getValue: function(td) {
						return $(td).data().ts;
					}
				}
			]
		});
	}
	
	/**
	 * Triggers deleting the whole history of the current note.
	 */
	#deleteHistory() {
		if (!this.#current) return;

		var doc = this._app.data.getById(this.#current._id);
		if (!doc) return;
		
		if (!confirm("Do you really want to delete the whole version history of " + doc.name + '?')) {
			this._app.showAlert("Action cancelled.", "I");
			return;
		}

		var that = this;
		this._app.actions.history.deleteHistory(this.#current._id)
		.then(function(/*data*/) {
			that._app.actions.history.showHistory(that.#current._id);
		})
		.catch(function(err) {
			that._app.showAlert('Error deleting history: ' + (err.message ? err.message : ''), 'E', err.messageThreadId)
		});
	}
	
	/**
	 * Delete the change log of the note.
	 */
	#deleteChangeLog() {
		if (!this.#current) return;

		var doc = this._app.data.getById(this.#current._id);
		if (!doc) return;
		
		if (!confirm("Do you really want to delete the whole change log of " + doc.name + '?')) {
			this._app.showAlert("Action cancelled.", "I");
			return;
		}
		
		var that = this;
		this._app.actions.document.deleteChangeLog(this.#current._id)
		.then(function(/*data*/) {
			that._app.actions.history.showHistory(that.#current._id);
		})
		.catch(function(err) {
			that._app.showAlert('Error deleting change log: ' + (err.message ? err.message : ''), 'E', err.messageThreadId)
		});
	}
}