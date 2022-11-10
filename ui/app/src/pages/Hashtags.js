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
class Hashtags {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Hashtags.instance) Hashtags.instance = new Hashtags();
		return Hashtags.instance;
	}
	
	/**
	 * Load the page. ID is optional.
	 */
	load(id) {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		var doc = null;
		if (id) doc = n.getData().getById(id);

		// Get list of tags
		var tags = n.getData().getTags(doc ? [doc] : null);
		
		// Header text
		n.setStatusText("All Hashtags" + (doc ? (' of ' + (doc.name ? doc.name : doc._id)) : '') + ' (' + tags.length + ')');
		
		// Build new table from the data
		$('#contentContainer').empty();
		var rows = new Array();
		
		var that = this;
		for(var i in tags || []) {
			const tag = tags[i];
			
			const numDocs = n.getData().getDocumentsWithTag(tag);
			const tagColor = Hashtag.getColor(tag);
			
			// Action buttons (only for current document's labels)
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Search for documents with the tag" class="fa fa-search versionButton" data-id="' + tag + '"/>')
					.on('click', function(e) {
						e.stopPropagation();
						var id = $(this).data().id;

						NoteTree.getInstance().setSearchText('tag:' + id);
					}),
				]
			);
			
			rows.push(
				$('<tr>')
				.append(
					[
						$('<td data-id="' + tag + '"></td>').append(
							$('<span class="notesHashTag" data-id="' + tag + '"></span>')
							.html('#' + tag)
							.css('background-color', tagColor)
							.css('color', Tools.getForegroundColor(tagColor))
							.on('click', function(e) {
								e.stopPropagation();
								var id = $(this).data().id;

								NoteTree.getInstance().setSearchText('tag:' + id);
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
								
								that.setTagColor(id, $(this).val());
					        })
						),

						$('<td/>').append(
							butts
						),
					]					
				)
			);
		}
		
		$('#contentContainer').append(
			$('<table class="table table-striped table-hover" id="tagsTable" />').append(
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
		
		Tools.makeTableSortable($('#tagsTable'), {
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
	 * Unload instance
	 */
	unload() {
	}
	
	/**
	 * Set a tag's color in the global meta data document.
	 */
	setTagColor(tag, color) {
		Hashtag.setColor(tag, color)
		.then(function() {
			return TreeActions.getInstance().requestTree();
		});
	}
}