/**
 * Global hashtags overview.
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
class HashtagsPage extends Page {
	
	#current = null;    // Current document
	
	/**
	 * Can be used to signal that the page also needs all navigation data loaded.
	 */
	needsHierarchyData() {
		return true;
	}
	
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
	 * Load the page. ID is optional. id is optional.
	 */
	async load(id) {
		var doc = null;
		if (id) doc = this._app.data.getById(id);

		this.#current = doc;

		// Get list of tags 
		var tags = this._app.data.getTags(doc ? [doc] : null);
		
		// Header text
		this._tab.setStatusText("All Hashtags" + (doc ? (' of ' + (doc.name ? doc.name : doc._id)) : '') + ' (' + tags.length + ')');
		
		// Build new table from the data
		var rows = new Array();
		
		var that = this;
		for(var i in tags || []) {
			const tag = tags[i];
			
			const numDocs = this._app.data.getDocumentsWithTag(tag);
			const tagColor = this._app.hashtag.getColor(tag);
			
			// Action buttons (only for current document's labels)
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Search for documents with the tag" class="fa fa-search versionButton" data-tag="' + tag + '"/>')
					.on('click', function(e) {
						e.stopPropagation();
						
						var tag = $(this).data().tag;
						that._app.hashtag.showTag(tag);
					}),
					
					$('<div data-toggle="tooltip" title="Rename tag in all ' + numDocs.length + ' documents" class="fa fa-pencil-alt versionButton" data-tag="' + tag + '"/>')
					.on('click', function(e) {
						e.stopPropagation();
						
						var tag = $(this).data().tag;
						that.#renameTags(tag);
					}),
				]
			);
			
			rows.push(
				$('<tr>')
				.append(
					[
						$('<td data-id="' + tag + '"></td>').append(
							$('<span class="notesHashTag" data-tag="' + tag + '"></span>')
							.html('#' + tag)
							.css('background-color', tagColor)
							.css('color', Tools.getForegroundColor(tagColor))
							.on('click', function(e) {
								e.stopPropagation();

								var tag = $(this).data().tag;
								that._app.hashtag.showTag(tag);
							})							
						),
						
						$('<td data-id="' + tag + '" data-numdocs="' + numDocs.length + '"></td>').append(
							$('<span></span>')
							.html(numDocs.length)
						),
						
						$('<td/>').append(
							$('<input type="color" data-id="' + tag + '" value="' + tagColor + '">')
							.on('blur', function(event) {
					        	event.stopPropagation();
								
					        	var id = $(this).data().id;
								that.#setTagColor(id, $(this).val());
					        })
						),

						$('<td/>').append(
							butts
						),
					]					
				)
			);
		}
		
		var tagsTable = $('<table class="table table-striped table-hover" />');
		
		this._tab.getContainer().append(
			tagsTable.append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th>Tag</th>'),
								$('<th>Num. Documents</th>'),
								$('<th>Color</th>'),
								$('<th>Options</th>'),
							]
						)
					),
					$('<tbody/>').append(rows),
				]
			),
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
		Tools.makeTableSortable(tagsTable, {
			excludeColumns: [2, 3],
			sortData: [
				{
					colIndex: 0,
					getValue: function(td) {
						return $(td).data().id.toLowerCase();
					}
				},
				{
					colIndex: 1,
					getValue: function(td) {
						return $(td).data().numdocs;
					}
				},
			]
		});
	}
	
	/**
	 * Prompt user for a new tag name and rename it in all documents. Returns a Promise.
	 */
	#renameTags(tag) {
		var that = this;
		
		const docs = this._app.data.getDocumentsWithTag(tag);
		
		var doclist = '';
		for(var i in docs) {
			const doc = docs[i];
			doclist += this._app.formatSelectOptionText(this._app.data.getReadablePath(doc._id, null, true)) + '\n';
		}
		
		var newTag = prompt('Enter the new tag name. The following documents will be updated: \n' + doclist, tag);
		if (!newTag) {
			this._app.showAlert('Action cancelled.', 'I', 'RenameTagMessages');
			return;
		}
		
		this._app.actions.hashtag.renameTag(tag, newTag)
		.then(function(ret) {
			if (ret && ret.message) {
				that._app.showAlert(ret.message, 'S', 'RenameTagMessages');				
			} else {
				that._app.showAlert('Renamed ' + tag + ' to ' + newTag, 'S', 'RenameTagMessages');
			}

			that._app.routing.callHashtags(that.#current ? that.#current._id : null);
		})
		.catch(function(err) {
			that._app.showAlert((err && err.message) ? err.message : 'Error renaming hashtag', 'E', 'RenameTagMessages');
		})
	}
	
	/**
	 * Set a tag's color in the global meta data document.
	 */
	#setTagColor(tag, color) {
		var that = this;
		
		this._app.actions.hashtag.setColor(tag, color)
		.then(function() {
			that._app.routing.callHashtags(that.#current ? that.#current._id : null);
			that._app.actions.nav.requestTree();
		})
		.catch(function(err) {
			that._app.showAlert((err && err.message) ? err.message : 'Error setting hashtag color', 'E', 'SetTagColorMessages');
		})
	}
}