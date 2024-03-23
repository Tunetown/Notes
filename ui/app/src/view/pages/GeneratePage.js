/**
 * Document Generator
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
class GeneratePage extends Page {

	#options = { ...Generator.defaultOptions }; // Clone the defaults
	
	/**
	 * Can be used to signal that the page also needs all navigation data loaded.
	 */
	needsHierarchyData() {
		return true;
	}

	/**
	 * Loads the passed version history data into the versions view.
	 */
	async load() {
		this._tab.setStatusText("Generate Random Documents"); 
		
		// Parent selector
		var targetSelector = this._app.getMoveTargetSelector();
		
		// Build page
		var that = this;
		this._tab.getContainer().append(
			$('<table class="table settingsForm"/>').append(
				$('<tbody>').append(
					[
						$('<tr class="bg-primary" />').append(
							[
								$('<th class="settingsHdCol" scope="col">Location</th>'),
								$('<th scope="col"></th>'),
							]
						),
						$('<tr/>').append(
							$('<td class="w-auto">Parent Document</td>'),
							$('<td/>').append(
								targetSelector
								.on('change', function(/*event*/) {
									that.#options.parentId = this.value;
								})
							)
						),
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Hierarchy Options</th>'),
								$('<th scope="col"></th>'),
							]
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Deepness</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.depth) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.depth = val;
								}),
								$('<span class="settings-explanation">Hierarchical deepness. Set to zero to only create one level.</span>')
							)
						),	
						
						$('<tr/>').append(
							$('<td class="w-auto">Children</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.numChildren) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.numChildren = val;
								}),
								$('<span class="settings-explanation">Number of Children generated for each document.</span>')
							)
						),	
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Content Options</th>'),
								$('<th scope="col"></th>'),
							]
						),
						
						$('<tr/>').append(
							$('<td class="w-auto">Min. size</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.contentMinSizeChars) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.contentMinSizeChars = val;
								}),
								$('<span class="settings-explanation">Minimum number of characters in the randomly created content.</span>')
							)
						),	
						
						$('<tr/>').append(
							$('<td class="w-auto">Max. size</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.contentMaxSizeChars) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.contentMaxSizeChars = val;
								}),
								$('<span class="settings-explanation">Maximum number of characters in the randomly created content.</span>')
							)
						),	
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Random Linkages</th>'),
								$('<th scope="col"></th>'),
							]
						),

						$('<tr/>').append(
							$('<td class="w-auto">Linkage density</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.#options.randomLinkagesDensity) + '" />')
								.on('change', function() {
									var val = parseFloat(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseFloat(this.value);
									}
									if (val > 1) {
										this.value = 1;
										val = parseFloat(this.value);
									}
									
									that.#options.randomLinkagesDensity = val;
								}),
								$('<span class="settings-explanation">Likelihood of random in-document links being created, in range [0..1]. Set to zero to disable random linkages at all</span>')
							)
						),	
						
						$('<tr/>').append(
							$('<td class="w-auto">Min. amount</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.randomLinkagesMinAmount) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.randomLinkagesMinAmount = val;
								}),
								$('<span class="settings-explanation">Minimum amount of linkages created per document (if it gets any linkages at all, determined by the density setting).</span>')
							)
						),	
						
						$('<tr/>').append(
							$('<td class="w-auto">Min. amount</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.randomLinkagesMaxAmount) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.randomLinkagesMaxAmount = val;
								}),
								$('<span class="settings-explanation">Maximum amount of linkages created per document (if it gets any linkages at all, determined by the density setting).</span>')
							)
						),	
						
						$('<tr class="bg-primary" />').append(
							[
								$('<th scope="col">Random References</th>'),
								$('<th scope="col"></th>'),
							]
						),

						$('<tr/>').append(
							$('<td class="w-auto">Reference density</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseFloat(this.#options.randomReferencesDensity) + '" />')
								.on('change', function() {
									var val = parseFloat(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseFloat(this.value);
									}
									if (val > 1) {
										this.value = 1;
										val = parseFloat(this.value);
									}
									
									that.#options.randomReferencesDensity = val;
								}),
								$('<span class="settings-explanation">Likelihood of random reference documents being created, in range [0..1]. Set to zero to disable random reference documents at all</span>')
							)
						),	
						
						$('<tr/>').append(
							$('<td class="w-auto">Min. amount</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.randomReferencesMinAmount) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.randomReferencesMinAmount = val;
								}),
								$('<span class="settings-explanation">Minimum amount of references created per document (if it gets any references at all, determined by the density setting).</span>')
							)
						),	
						
						$('<tr/>').append(
							$('<td class="w-auto">Max. amount</td>'),
							$('<td/>').append(
								$('<input type="text" value="' + parseInt(this.#options.randomReferencesMaxAmount) + '" />')
								.on('change', function() {
									var val = parseInt(this.value);
									if (val < 0) {
										this.value = 0;
										val = parseInt(this.value);
									}
									
									that.#options.randomReferencesMaxAmount = val;
								}),
								$('<span class="settings-explanation">Maximum amount of references created per document (if it gets any references at all, determined by the density setting).</span>')
							)
						),	
					]
				)
			),
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
		// Enable searching by text entry
		targetSelector.selectize({
			sortField: 'text'
		});
		
		// Build buttons
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Generate" class="fa fa-plus"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#generate();
			}),
		]);
	}
	
	/**
	 * Generate documents
	 */
	#generate() {
		var data = new Generator().createData(this.#options);

		if (!confirm('Do you really want to create ' + data.length + ' random doduments under ' + (this.#options.parentId ? this.#options.parentId : 'notebook root') + '?')) {
			this._app.showAlert('Action cancelled.', 'I', 'generateDocuments');
			return;
		}

		this._app.showAlert('Started generating documents, please wait...', 'I', 'generateDocuments'); 
		
		var promises = [];
		for(var i in data) {
			promises.push(this._app.documentAccess.saveDbDocument(data[i]));
		}
		
		var that = this;
		return Promise.all(promises)
		.then(function() {
			return that._app.actions.nav.requestTree();
		})
		.then(function() {
			that._app.showAlert('Successfully generated ' + data.length + ' documents', 'S', 'generateDocuments'); 
		})
		.catch(function(err) {
			if (err && err.message) {
				that._app.showAlert('Error generating documents: ' + err.message, 'E', 'generateDocuments');
			} else {
				that._app.showAlert('Error generating documents', 'E', 'generateDocuments');
			}
		});
	}
}