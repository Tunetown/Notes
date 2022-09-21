/**
 * Shows all conflicts
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
class Conflicts {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Conflicts.instance) Conflicts.instance = new Conflicts();
		return Conflicts.instance;
	}
	
	/**
	 * Load the conflict list (after all docs have been loaded!)
	 */
	load() {
		var n = Notes.getInstance();
		var data = n.getData();
		
		// Build new table from the data
		var rows = new Array();
		data.each(function(doc) {
			if (!data.hasConflicts(doc._id)) return; 
			
			for(var c in doc._conflicts) {
				var butts = $('<span class="listOptionContainer" />').append([
					$('<div data-toggle="tooltip" title="View Conflict" class="fa fa-eye versionButton" data-id="' + doc._id + '" data-rev="' + doc._conflicts[c] + '"/>')
					.on('click', function(e) {
						var id = $(this).data().id;
						var rev = $(this).data().rev;
						
						NoteTree.getInstance().focus(id);
						Notes.getInstance().routing.callConflict(id, rev);
					}),
						
					$('<div data-toggle="tooltip" title="Delete Conflict" class="fa fa-trash versionButton" data-id="' + doc._id + '" data-rev="' + doc._conflicts[c] + '"/>')
					.on('click', function(e) {
						var id = $(this).data().id;
						var rev = $(this).data().rev;
						
						DocumentActions.getInstance().deleteItemPermanently(id, rev)
						.then(function(data) {
							if (data.message) {
								Notes.getInstance().showAlert(data.message, "S", data.messageThreadId);
							}
						}).catch(function(err) {
							Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
						});
					})
				]);
			
				rows.push(
					$('<tr>').append([
							$('<td data-id="' + doc._id + '">' + doc.name + '</td>')
							.on('click', function(e) {
								var id = $(this).data().id;
								
								NoteTree.getInstance().focus(id);
								Notes.getInstance().routing.call(id);
							}),
							$('<td>' + doc._conflicts[c] + '</td>'),
							$('<td>' + doc._rev + '</td>'),
							$('<td/>').append(butts),
					])
				);
			}
		});
		
		$('#contentContainer').append(
			$('<table class="table table-striped table-hover" id="conflictsTable"/>').append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Document</th>'),
								$('<th scope="col">Revision</th>'),
								$('<th scope="col">Head</th>'),
								$('<th scope="col">Actions</th>'),
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
		
		Tools.makeTableSortable($('#conflictsTable'), {
			excludeColumns: [3]
		});
	}
}