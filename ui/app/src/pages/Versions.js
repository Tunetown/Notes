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
class Versions {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Versions.instance) Versions.instance = new Versions();
		return Versions.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	load(doc) {
		var that = this;
		var n = Notes.getInstance();
		
		this.currentId = doc._id;
		
		n.setStatusText("History of " + doc.name);
		$('#contentContainer').empty();
		
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
					$('<div data-toggle="tooltip" title="View Version" class="fa fa-eye versionButton" id="vref_' + attachments[i].name + '"/>')
					.on('click', function(e) {
						var name = $(this).attr('id').substring('vref_'.length);
						
						var v = Versions.getInstance();
						
						Notes.getInstance().routing.call("history/" + v.currentId + "/" + name);
					}),
					$('<div data-toggle="tooltip" title="Delete Version" class="fa fa-trash versionButton" id="vref_' + attachments[i].name + '"/>')
					.on('click', function(e) {
						var name = $(this).attr('id').substring('vref_'.length);
						
						if (!confirm("Do you really want to delete " + name + "?")) {
							Notes.getInstance().showAlert("Action cancelled.", "I");
							return;
						}
						
						var v = Versions.getInstance();
						HistoryActions.getInstance().deleteVersion(v.currentId, name)
						.then(function(data) {
							if (data.message) Notes.getInstance().showAlert(data.message, 'S', data.messageThreadId);
						})
						.catch(function(err) {
							Notes.getInstance().showAlert('Error deleting version: ' + err.message, 'E', err.messageThreadId);
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
		
		// Table buildup
		$('#contentContainer').append(
			$('<div class="h4 contentHeadline"></div>').append(
				$('<div class="contentHeadlineText">Version History (' + rows.length + ' Entries, ' + versionSizeStr + ')</div>'),
				$('<div type="button" data-toggle="tooltip" title="Delete Version History" class="contentHeadlineButton fa fa-trash"></div>')
				.on('click', function(event) {
					event.stopPropagation();
					that.deleteHistory();
				})
			),
			$('<table class="table table-striped table-hover" id="versionsTable" />').append(
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
					that.deleteChangeLog();
				})
			),
			$('<table class="table table-striped table-hover" id="changeLogTable" />').append(
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
		
		Tools.makeTableSortable($('#versionsTable'), {
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
		
		Tools.makeTableSortable($('#changeLogTable'), {
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
	 * Unload instance
	 */
	unload() {
		this.currentId = null;
	}
	
	/**
	 * Triggers deleting the whole history of the current note.
	 */
	deleteHistory() {
		if (!this.currentId) return;
		var n = Notes.getInstance();

		var doc = n.getData().getById(this.currentId);
		if (!doc) return;
		
		if (!confirm("Do you really want to delete the whole version history of " + doc.name + '?')) {
			n.showAlert("Action cancelled.", "I");
			return;
		}

		var that = this;
		HistoryActions.getInstance().deleteHistory(this.currentId)
		.then(function(/*data*/) {
			HistoryActions.getInstance().showHistory(that.currentId);
		})
		.catch(function(err) {
			n.showAlert('Error deleting history: ' + (err.message ? err.message : ''), 'E', err.messageThreadId)
		});
	}
	
	/**
	 * Delete the change log of the note.
	 */
	deleteChangeLog() {
		if (!this.currentId) return;
		var n = Notes.getInstance();

		var doc = n.getData().getById(this.currentId);
		if (!doc) return;
		
		if (!confirm("Do you really want to delete the whole change log of " + doc.name + '?')) {
			n.showAlert("Action cancelled.", "I");
			return;
		}
		
		var that = this;
		DocumentActions.getInstance().deleteChangeLog(this.currentId)
		.then(function(data) {
			HistoryActions.getInstance().showHistory(that.currentId);
		})
		.catch(function(err) {
			n.showAlert('Error deleting change log: ' + (err.message ? err.message : ''), 'E', err.messageThreadId)
		});
	}
}