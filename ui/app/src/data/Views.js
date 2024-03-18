/**
 * Defines and cares about the views on database.
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
class Views {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Returns the ID of the design document where all views are stored. 
	 */
	getViewDocId() {
		return 'views_' + this.#app.appVersion;
	}
	
	/**
	 * Called at initial loading the app, to check if all views are there and up to date, 
	 * and to create/update them if not.
	 */
	updateViews() {
		var that = this;
		return this.createOrUpdateViews(
			that.getViewDocId(), 
			Document.getViewDefinitions()
		);
	}
	
	/**
	 * Creates or updates the passed view.
	 */
	createOrUpdateViews(designDocId, views) {
		var changed = [];
		var docCreated = false;
		
		var db;
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.get('_design/' + designDocId)
			.catch(function(/*err*/) {
				return Promise.resolve({
					notFound: true
				});
			});
		})
		.then(function(ddocPers) {
			if (!ddocPers || ddocPers.notFound) {
				// Design document not found: Create it
				console.log(' -> MapReduce: Creating design document ' + designDocId);
				docCreated = true;
				
				ddocPers = {
					_id: '_design/' + designDocId,
					views: {}
				};
			} 
			
			// Design document exists: Check if the document has been modified
			if (!ddocPers.views) {
				ddocPers.views = {};	
			}
				
			for (var v in views) {
				var view = views[v];
				if (ddocPers.views.hasOwnProperty(view.name)) {
					var mapPers = ddocPers.views[view.name];
					if (mapPers.map) {
						var viewStr = view.map.toString();
						if (mapPers.map == viewStr) {
							// Not changed
							//console.log(' -> MapReduce: View ' + view.name + ' is still up to date.');
							continue;
						} else {
							console.log(' -> MapReduce: View ' + view.name + ' has been changed.');
						} 
					} else {
						console.log(' -> MapReduce: View ' + view.name + ' does not have a map function.');
					}
				} else {
					console.log(' -> MapReduce: View ' + view.name + ' does not exist.');
				}
				
				changed.push(view);
			}
			
			if (!changed.length) {
				//console.log(' -> MapReduce: All ' + views.length + ' views are up to date.');
				return Promise.resolve({
					nothingDone: true,
					ok: true
				});
			}
			
			// Design document exists but some views are either out of date or not existing.
			for(var v in changed) {
				var view = changed[v];

				console.log(' -> MapReduce: Updating/creating view ' + view.name);
				
				ddocPers.views[view.name] = {
					map: view.map.toString()
				};		
			}
			
			return db.put(ddocPers);
		})
		.then(function(data) {
			if (!data.ok) {
				return Promise.reject({
					message: 'Error: ' + data.message,
					messageThreadId: 'DBUpdateViewsMessages'
				});
			}
			
			if (data.nothingDone) {
				return Promise.resolve({
					ok: true,
				});
			}
			
			var promises = [];
			for(var v in views) {
				var view = views[v];
				var viewName = view.name;
				console.log('   -> MapReduce: Build view ' + viewName);
				
				promises.push(
					db.query(designDocId + '/' + viewName, {
						limit: 0 // don't return any results
					})
					.catch(function (err) {
						return Promise.reject({
							message: 'Error building view: ' + err.message,
							messageThreadId: 'DBUpdateViewsMessages'
						});
					})
				);
			}
			
			return Promise.all(promises);
		})
		.then(function(/*data*/) {
			return Promise.resolve({
				ok: true,
				docCreated: docCreated,
				updatedViews: changed
			});
		});
	}

	/**
	 * Removes unused views.
	 */
	deleteUnusedViews() {
		var that = this;
		var db;
		var docs = [];
		
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.allDocs({
				startkey: '_',
				endkey: '_\ufff0',
				include_docs: true
			});
		})
		.then(function(data) {
			for(var i in data.rows) {
				var doc = data.rows[i].doc;
				if (doc._id == '_design/' + that.getViewDocId()) continue;
				
				console.log(' -> Deleting design document ' + doc._id);
				
				doc._deleted = true;
				docs.push(doc);
			}
			
			if (docs.length == 0) return Promise.reject({
				message: 'No documents to update.',
				messageThreadId: 'DeleteViewsMessages'
			});
			
			return db.bulkDocs(docs);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: data.message ? data.message : ('Removed ' + docs.length + ' unused design documents.'),
				messageThreadId: 'DeleteViewsMessages'
			});
		});
	}
	
	/**
	 * Check unused views.
	 */
	checkUnusedViews() {
		var that = this;
		
		return this.#app.db.get()
		.then(function(db) {
			return db.allDocs({
				startkey: '_',
				endkey: '_\ufff0'
			});
		})
		.then(function(data) {
			var errors = [];
			for(var i in data.rows) {
				var doc = data.rows[i];
				if (doc.id == '_design/' + that.getViewDocId()) continue;
				
				errors.push({
					message: 'Unused view',
					messageThreadId: 'CheckViewsMessages',
					id: doc.id,
					type: 'W'
				});
			}
			
			var ok = errors.length == 0;
			if (ok) {
				errors.push({
					message: 'No unused design documents found',
					messageThreadId: 'CheckViewsMessages',
					type: 'S'
				});
			}
			return Promise.resolve({
				docsChecked: data.rows,
				numChecked: data.rows.length,
				errors: errors,
				warning: !ok,
				ok: true
			});
		});
	}
	
	/**
	 * Check views.
	 */
	checkViews() {
		var that = this;
		return this.checkViewsInternal(
			this.getViewDocId(), 
			Document.getViewDefinitions()
		)
		.then(function(data) {
			return that.#app.db.checkConflicts('_design/' + that.getViewDocId())
			.then(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.resolve(resp);
			})
			.catch(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.reject(resp);
			});
		});
	}
	
	/**
	 * Check views (internal).
	 */
	checkViewsInternal(designDocId, views) {
		var errors = [];
		
		var db;
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.get('_design/' + designDocId)
			.catch(function(/*err*/) {
				errors.push({
					message: 'Design document ' + designDocId + ' not found',
					messageThreadId: 'DBCheckViewsMessages',
					id: designDocId,
					type: 'E'
				});
				return Promise.reject({
					errors: errors
				});
			});
		})
		.then(function(ddocPers) {
			if (!ddocPers) {
				errors.push({
					message: 'Design document ' + designDocId + ' not found (2)',
					messageThreadId: 'DBCheckViewsMessages',
					id: designDocId,
					type: 'E'
				});
				return Promise.reject({
					errors: errors
				});
			} 
			
			// Design document exists: Check if the document has been modified
			if (ddocPers.views) {
				for (var v in views) {
					var view = views[v];
					if (ddocPers.views.hasOwnProperty(view.name)) {
						var mapPers = ddocPers.views[view.name];
						if (mapPers.map) {
							if (mapPers.map == view.map.toString()) {
								// Not changed
								//console.log(' -> MapReduce: View ' + view.name + ' is still up to date.');
								continue;
							} else {
								errors.push({
									message: 'View ' + view.name + ' is out of date.',
									id: designDocId,
									type: 'E'
								});
							} 
						} else {
							errors.push({
								message: 'View ' + view.name + ' does not have a map function.',
								id: designDocId,
								type: 'E'
							});
						}
					} else {
						errors.push({
							message: 'View ' + view.name + ' does not exist.',
							id: designDocId,
							type: 'E'
						});
					}
				}
			} else {
				errors.push({
					message: 'No views found in ' + designDocId,
					id: designDocId,
					type: 'E'
				});
			}
			
			if (!errors.length) {
				errors.push({
					message: 'All ' + views.length + ' views are up to date.',
					id: designDocId,
					type: 'S'
				});
				return Promise.resolve({
					errors: errors,
					ok: true
				});
			} else {
				return Promise.reject({
					errors: errors
				});
			}
		});
	}
}