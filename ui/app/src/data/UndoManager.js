/**
 * Undo manager for notes app.
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
 *
class UndoManager {
	
	static experimentalFunctionId = 'UndoManager';
	
	/**
	 * Singleton factory
	 *
	static getInstance() {
		if (!UndoManager.instance) UndoManager.instance = new UndoManager();
		return UndoManager.instance;
	}
	
	static STEP_TYPE_DOCUMENT_BASED = 'doc';
	static STEP_TYPE_CALLBACK_BASED = 'callback';

	/**
	 * Adds a new undo step. This invalidates all steps after the current position.
	 *
	 * A step can be one of the following (all attributes are mandatory):
	 *
	 * { 
	 *   type: UndoManager.STEP_TYPE_DOCUMENT_BASED,
	 *   name: 'Name of the undo step'
	 *   doc: [Document Object to be saved to make things undone],
	 * }
	 *  
	 * or: 
	 *
	 * { 
	 *   type: UndoManager.STEP_TYPE_CALLBACK_BASED,
	 *   name: 'Name of the undo step'
	 *   undoCallback: [Callback function for undoing, parameter: the step object itself],
	 *   redoCallback: [Callback function for redoing, parameter: the step object itself],
	 * }
	 *  
	 *
	add(step) {
		if (!ClientState.getInstance().experimentalFunctionEnabled(UndoManager.experimentalFunctionId)) return;
		
		this.#checkStep(step);
		this.#condense();
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			// Deep clone the document in the step.
			step.doc = JSON.parse(JSON.stringify(step.doc));
		}
		
		// Add step
		var history = ClientState.getInstance().getUndoHistory();
		history.steps.push(step);
		++history.position;
		ClientState.getInstance().setUndoHistory(history);
		
		this.#reduce();
		
		// DEBUG
		if (ClientState.getInstance().getUndoHistory().position != (ClientState.getInstance().getUndoHistory().steps.length - 1)) throw new Error('Internal Error: Inconsisten UndoManager position');
		console.log(' -> UNDO MANAGER: Added step "' + step.name + '". Position: ' + ClientState.getInstance().getUndoHistory().position + ' of ' + ClientState.getInstance().getUndoHistory().steps.length);
	}
	
	/**
	 * Shortcut for add() for document based steps.
	 *
	addDocumentBased(step) {
		step.type = UndoManager.STEP_TYPE_DOCUMENT_BASED;
		this.add(step);
	}
	
	/**
	 * Shortcut for add() for callback based steps.
	 *
	addCallbackBased(step) {
		step.type = UndoManager.STEP_TYPE_CALLBACK_BASED;
		this.add(step);
	}
	
	/**
	 * Is there a undo step to be undone? history is optional for internal use.
	 *
	canUndo() {
		if (!ClientState.getInstance().experimentalFunctionEnabled(UndoManager.experimentalFunctionId)) return false;
		
		const history = ClientState.getInstance().getUndoHistory();
		return history.position >= 0;
	}
	
	/**
	 * Is redoing possible? history is optional for internal use.
	 *
	canRedo() {
		if (!ClientState.getInstance().experimentalFunctionEnabled(UndoManager.experimentalFunctionId)) return false;
		
		const history = ClientState.getInstance().getUndoHistory();
		return (history.position < (history.steps.length - 1));
	}
	
	/**
	 * Returns the next undo step or null. history is optional for internal use.
	 *
	getNextUndoStep() {
		if (!this.canUndo()) return null;
		
		const history = ClientState.getInstance().getUndoHistory();
		var step = history.steps[history.position];
		this.#checkStep(step);
		
		return step;
	}
	
	/**
	 * Returns the next redo step or null. history is optional for internal use.
	 *
	getNextRedoStep() {
		if (!this.canRedo()) return null;

		const history = ClientState.getInstance().getUndoHistory();
		var step = history.steps[history.position + 1];
		this.#checkStep(step);
		
		return step;
	}
	
	/**
	 * Undo last step. Returns a promise.
	 *
	undo() {
		this.#checkHistory();
		if (!this.canUndo()) return Promise.resolve();
		
		var that = this;
		function decreasePosition() {
			var history = ClientState.getInstance().getUndoHistory();
			--history.position;
			ClientState.getInstance().setUndoHistory(history);
			
			that.#checkHistory();
		}
		
		const step = this.getNextUndoStep();

		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			// Document undo step: These store the document to be saved to make the step undone.
			return this.#performDocumentBasedUndoStep()
			.then(function() {
				decreasePosition();
				return Promise.resolve();
			})
		}
		
		if (step.type == UndoManager.STEP_TYPE_CALLBACK_BASED) {
			// Callback based undo step: Executes the passed callback with the undo step object as single parameter.
			return this.#performCallbackBasedUndoStep()
			.then(function() {
				decreasePosition();
				return Promise.resolve();
			})
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}

	/**
	 * Redo last undone step. Returns a promise.
	 *
	redo() {
		this.#checkHistory();
		if (!this.canRedo()) return Promise.resolve();

		var that = this;
		function increasePosition() {
			var history = ClientState.getInstance().getUndoHistory();
			++history.position;
			ClientState.getInstance().setUndoHistory(history);
			
			that.#checkHistory();
		}
		
		const step = this.getNextRedoStep();
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform undo/redo for document ' + step.doc._id + '; New Position: ' + history.position + ' of ' + history.steps.length);

			// Document redo step: These store the document to be saved to make the step undone.
			return this.#performDocumentBasedRedoStep()
			.then(function() {
				increasePosition();
				return Promise.resolve();
			})
		}
		
		if (step.type == UndoManager.STEP_TYPE_CALLBACK_BASED) {
			console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform undo/redo by callback; New Position: ' + history.position + ' of ' + history.steps.length);
		
			// Callback based undo step: Executes the passed callback with the undo step object as single parameter.
			return this.#performCallbackBasedRedoStep()
			.then(function() {
				increasePosition();
				return Promise.resolve();
			})
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Document undo step: These store the document to be saved to make the step undone.
	 *
	#performDocumentBasedUndoStep() {
		const that = this;
		
		var step = this.getNextUndoStep();
		
		// Save the document contained in the step.
		return DocumentAccess.getInstance().saveDbDocumentIgnoringRevision(step.doc)
		.then(function(resp) {
			if (!resp || !resp.ok || !resp.oldDoc) {
				return Promise.reject();
			}
			
			step.redoDoc = resp.oldDoc;
			
			that.#replaceCurrentStep(step);
			
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Document redo step: The undo step before saved a redo document.
	 *
	#performDocumentBasedRedoStep() {
		// Save the document contained in the step.
		return DocumentAccess.getInstance().saveDbDocumentIgnoringRevision(step.redoDoc)
		.then(function(resp) {
			if (!resp || !resp.ok || !resp.oldDoc) {
				return Promise.reject();
			}
			
			delete step.redoDoc;
			
			that.#replaceCurrentStep(step);
			
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Callback based undo step: Executes the passed undo callback with the undo step object as single parameter.
	 *
	#performCallbackBasedUndoStep() {
		return step.undoCallback(step)
		.then(function() {
			if (!resp || !resp.ok || !resp.oldDoc) {
				return Promise.reject();
			}
			
			that.#replaceCurrentStep(step);
			
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Callback based redo step: Executes the passed redo callback with the undo step object as single parameter.
	 *
	#performCallbackBasedRedoStep() {
		return step.redoCallback(step)
		.then(function() {
			if (!resp || !resp.ok || !resp.oldDoc) {
				return Promise.reject();
			}
			
			that.#replaceCurrentStep(step);
			
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Replaces the step at the current position with the passed one.
	 *
	#replaceCurrentStep(step) {
		var history = ClientState.getInstance().getUndoHistory();
		history.steps[history.position] = step;
		ClientState.getInstance().setUndoHistory(history);
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Removes all steps after the current position.
	 *
	#condense() {
		var history = ClientState.getInstance().getUndoHistory();
		console.log(' -> UNDO MANAGER: Condensing history, current size: ' + history.steps.length + ' ...');
		
		while(history.steps.length > (history.position + 1)) {
			history.steps.pop();
		}
		
		ClientState.getInstance().setUndoHistory(history);
		this.#checkHistory();
		
		console.log('              ... new size: ' + ClientState.getInstance().getUndoHistory().steps.length + ', position: ' + ClientState.getInstance().getUndoHistory().position);
	}
	
	/**
	 * Reduce if the max. amount of steps has been reached.
	 *
	#reduce() {
		var history = ClientState.getInstance().getUndoHistory();
		while(history.steps.length > Config.undoMaxHistorySize) {
			console.log(' -> UNDO MANAGER: Max. size reached, removing first step');
			
			history.steps.shift();
			--history.position;
		}
		
		ClientState.getInstance().setUndoHistory(history);
		this.#checkHistory();
	}
	
	/**
	 * Check step consistency.
	 *
	#checkStep(step) {
		if (!step) throw new Error('No step data');
		if (!step.type) throw new Error('No step type');
		if (!step.name) throw new Error('No step name');
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			if (!step.doc) throw new Error('No undo document for doc based step');
			return;
		}
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			if (!step.undoCallback) throw new Error('No undo callback for callback based undo step');
			if (!step.redoCallback) throw new Error('No redo callback for callback based undo step');
			return;
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}
	
	/**
	 * Checks the history and position.
	 *
	#checkHistory() {
		const history = ClientState.getInstance().getUndoHistory();
		
		if ((history.steps.length == 0) && (history.position == -1)) return;
		if (history.position < 0) throw new Error('Invalid position: ' + history.position + ' (size: ' + history.steps.length + ')');
		if (history.position >= history.steps.length) throw new Error('Invalid position: ' + history.position + ' (size: ' + history.steps.length + ')');
		
		for(var i in history.steps) {
			const step = history.steps[i];
			
			this.#checkStep(step);
			
			if (i > history.position) {
				if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
					if (!step.redoDoc) throw new Error('Internal Error: Undoed step "' + step.name + '" does not have a redo document at positon ' + i + ' of ' + history.steps.length + ' (current position: ' + history.position + ')');
				}
			} else {
				if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
					if (step.redoDoc) throw new Error('Internal Error: Step "' + step.name + '" has an illegal redo document at positon ' + i + ' of ' + history.steps.length + ' (current position: ' + history.position + ')');
				}
			}
		}
	}
}