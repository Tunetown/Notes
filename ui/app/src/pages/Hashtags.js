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
	 * Load the page.
	 */
	load() {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		n.setStatusText("All Hashtags");
		
		// Clear list
		$('#contentContainer').empty();
		
		// Get list of labels
		var tags = n.getData().getTagAutocompleteList();

		// Build new table from the data
		var rows = new Array();
		var that = this;
		for(var i in tags || []) {
			var tag = tags[i];
			if (!tag.id) continue;
			
			var numDocs = n.getData().getDocumentsWithTag(tag.id);
			
			// Action buttons (only for current document's labels)
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Search for documents with the tag" class="fa fa-search versionButton" data-id="' + tag.id + '"/>')
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
						$('<td data-id="' + tag.id + '"></td>').append(
							$('<span class="listLink" data-id="' + tag.id + '"></span>')
							.html('#' + tag.id)
							.on('click', function(e) {
								e.stopPropagation();
								var id = $(this).data().id;

								NoteTree.getInstance().setSearchText('tag:' + id);
							})							
						),
						
						$('<td data-id="' + tag.id + '" data-numdocs="' + numDocs.length + '"></td>').append(
							$('<span></span>')
							.html(numDocs.length)
						),
						
						$('<td/>').append(
							$('<input type="color" data-id="' + tag.id + '" value="' + '#f90' + '">')
							.on('blur', function(event) {
					        	event.stopPropagation();
					        	var id = $(this).data().id;
								
								//that.setLabelDefinitionColor(id, owner, $(this).val())
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
}