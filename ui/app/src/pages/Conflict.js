/**
 * Shows a conflict revision of a note.
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
class Conflict {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Conflict.instance) Conflict.instance = new Conflict();
		return Conflict.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 */
	load(docConflict, docCurrent) {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		// Set note name in the header
		n.setStatusText('Conflict: ' + docConflict.name + ' Revision from ' + new Date(docConflict.timestamp).toLocaleString());

		this.current = docConflict;
		
		var diffs = Diff.diffChars(Document.getContent(docCurrent), Document.getContent(docConflict));
		
		var rows = new Array();
		var pos = 0;
		for(var i in diffs) {
			var diff = diffs[i];
			
			if (diff.added || diff.removed) {
				rows.push(
					$('<tr>').append([
						$('<th class="tableAlignMiddle" scope="row">' + pos + '</th>'),
						$('<td class="tableAlignMiddle" />').append(
							diff.added 
							? $('<div class="fa fa-plus-circle conflictAddedIcon"></div>')
							: $('<div class="fa fa-minus-circle conflictRemovedIcon"></div>')
						),
						$('<td class="tableAlignMiddle" >' + diff.count + '</td>'),
						$('<td class="tableAlignMiddle" />').append(
							$('<xmp class="conflictChangeContent"></xmp>').html(diff.value)
						),
					])
				);
			}
			
			pos += diff.count;
		}
		
		$('#contentContainer').append(
			$('<table class="table table-striped table-hover" />').append(
				[
					$('<thead class="thead-dark"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Pos.</th>'),
								$('<th scope="col">+/-</th>'),
								$('<th scope="col">Length</th>'),
								$('<th scope="col">Change</th>'),
							]
						)
					),
					$('<tbody/>').append(rows),
				]
			),
			$('<hr>'),

			$('<div id="conflictData" class="mce-content-body" contenteditable="false"/>').html(Document.getContent(docConflict))
		);
		
		// Clear restore data
		Editor.getInstance().setVersionRestoreData(false);
		
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Set as winner" class="fa fa-redo" onclick="event.stopPropagation();Conflict.getInstance().setAsWinner();"></div>'),
			$('<div type="button" data-toggle="tooltip" title="Delete conflict" class="fa fa-trash" onclick="event.stopPropagation();Conflict.getInstance().deleteConflict();"></div>')
		]);			
	}
	
	/**
	 * Sets the current revision as winner and returns to the index page
	 */
	setAsWinner() {
		if (!this.current || !this.current._id || !this.current._rev) return;

		Editor.getInstance().setVersionRestoreData(Document.getContent(this.current));
		
		// Request the note. This loads the note into the editor freshly, and because the restoreData 
		// is filled, the editor will show this data in its load() method, in dirty state but without autosaving.
		Notes.getInstance().routing.call(this.current._id);
		
		this.current = null;
	}
	
	/**
	 * Deletes the current conflict and returns to the index page
	 */
	deleteConflict() {
		if (!this.current || !this.current._id || !this.current._rev) return;
		
		DocumentActions.getInstance().deleteItemPermanently(this.current._id, this.current._rev)
		.then(function(data) {
			if (data.message) {
				Notes.getInstance().showAlert(data.message, "S", data.messageThreadId);
			}
		}).catch(function(err) {
			Notes.getInstance().showAlert(err.message, 'E', err.messageThreadId);
		});
	}
}