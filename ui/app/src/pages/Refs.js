/**
 * References of a document
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
class Refs {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Refs.instance) Refs.instance = new Refs();
		return Refs.instance;
	}
	
	/**
	 * Show trash bin
	 */
	load(id) {
		var n = Notes.getInstance();
				
		var doc = n.getData().getById(id);
		if (!doc) {
			n.showAlert('Document ' + id + ' not found');
			return;
		}
		
		// Get refs to doc
		var refs = n.getData().getReferencesTo(id);
		
		// Set note name in the header bar
		n.setStatusText("References to " + doc.name);
		
		// Build table
		var rows = new Array();
		for(var i in refs) {
			var ref = refs[i];
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Delete Reference" class="fa fa-trash versionButton" data-id="' + ref._id + '"/>')
					.on('click', function(e) {
						var rid = $(this).data().id;
						Actions.getInstance().deleteItems([rid])
						.then(function(data) {
							if (data.message) Notes.getInstance().showAlert(data.message, 'S');
							Notes.getInstance().routing.call('refs/' + id);
						})
						.catch(function(err) {
							Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E');
						});
					})
				]
			);
			
			rows.push(
				$('<tr>').append(
					[
						$('<td style="cursor: pointer;" data-id="' + ref._id + '">' + n.getData().getReadablePath(ref._id) + '</td>')
						.on('click', function(e) {
							var id = $(this).data().id;
							NoteTree.getInstance().focus(id);
						}),
						$('<td data-ts="' + ref.timestamp + '">' + new Date(ref.timestamp).toLocaleString() + '</td>'),
						$('<td/>').append(butts),
					]					
				)
			);
		}

		$('#contentContainer').append(
			$('<table class="table table-striped table-hover" id="refsTable" />').append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Reference</th>'),
								$('<th scope="col">Last Changed</th>'),
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
		
		Tools.makeTableSortable($('#refsTable'), {
			excludeColumns: [2],
			sortData: [
				{
					colIndex: 1,
					getValue: function(td) {
						return $(td).data().ts;
					}
				}
			]
		});
	}
}