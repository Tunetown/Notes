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
class ConflictPage extends Page {
	
	#current = null;
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current.docConflict._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current ? this.#current.docConflict : null;
	}
	
	/**
	 * Reset the "currently shown" flags
	 */
	async unload() {
		this.#current = null;
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 * 
	 * {
	 * 	docConflict: conflict document
	 *  docCurrent:  current document
	 * }
	 */
	async load(data) {
		// Set note name in the header
		this._tab.setStatusText('Conflict: ' + data.docConflict.name + ' Revision from ' + new Date(data.docConflict.timestamp).toLocaleString());

		this.#current = data;
		
		var diffs = Diff.diffChars(Document.getContent(data.docCurrent), Document.getContent(data.docConflict));
		
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
		
		this._tab.getContainer().append(
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

			$('<div class="conflictData" class="mce-content-body" contenteditable="false"/>').html(
				Document.getContent(data.docConflict)
			)
		);
		
		// Clear restore data
		Document.setRestoreData(data.docConflict._id);
		
		var that = this;
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Set as winner" class="fa fa-redo"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#setAsWinner();
			}),
			
			$('<div type="button" data-toggle="tooltip" title="Delete conflict" class="fa fa-trash"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#deleteConflict();
			})
		]);			
	}
	
	/**
	 * Sets the current revision as winner and returns to the index page
	 */
	#setAsWinner() {
		if (!this.#current || !this.#current.docConflict || !this.#current.docConflict._id || !this.#current.docConflict._rev) return;

		Document.setRestoreData(this.#current.docConflict._id, Document.getContent(this.#current.docConflict));
		
		// Request the note. This loads the note into the editor freshly, and because the restoreData 
		// is filled, the editor will show this data in its load() method, in dirty state but without autosaving.
		this._app.routing.call(this.#current.docConflict._id);
		
		this.#current = null;
	}
	
	/**
	 * Deletes the current conflict and returns to the index page
	 */
	#deleteConflict() {
		if (!this.#current || !this.#current.docConflict || !this.#current.docConflict._id || !this.#current.docConflict._rev) return;
		
		var that = this;
		this._app.actions.document.deleteItemPermanently(this.#current.docConflict._id, this.#current.docConflict._rev)
		.then(function(data) {
			if (data.message) {
				that._app.view.message(data.message, "S", data.messageThreadId);
			}
		}).catch(function(err) {
			that._app.errorHandler.handle(err);
		});
	}
}