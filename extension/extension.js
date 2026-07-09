import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    ActivityKind,
    addTaskToList,
    createTrackerState,
    endTrackedSession,
    removeTaskFromList,
    renameTaskInList,
    restoreTrackerState,
    resumePreviousTaskFromBreak,
    resumePreviousTaskFromInterruption,
    serializeTrackerState,
    startBreakSession,
    startInterruptionSession,
    switchActiveTask,
    switchToNextTask,
} from './activityModel.js';
import {
    formatTopBarActivity,
    getBreakInterruptionMenuState,
    getReportMenuState,
} from './topBarViewModel.js';

const LABEL_REFRESH_INTERVAL_SECONDS = 60;
const STATE_DIRECTORY_NAME = 'focus-task';
const STATE_FILE_NAME = 'state.json';

function getStateFilePath() {
    return GLib.build_filenamev([
        GLib.get_user_data_dir(),
        STATE_DIRECTORY_NAME,
        STATE_FILE_NAME,
    ]);
}

function loadPersistedTrackerState() {
    const stateFilePath = getStateFilePath();

    if (!GLib.file_test(stateFilePath, GLib.FileTest.EXISTS))
        return createTrackerState();

    try {
        const [, contents] = GLib.file_get_contents(stateFilePath);
        const text = new TextDecoder().decode(contents);

        return restoreTrackerState(JSON.parse(text));
    } catch (error) {
        logError(error, 'Focus Task failed to load persisted state');
        return createTrackerState();
    }
}

function savePersistedTrackerState(trackerState) {
    const stateFilePath = getStateFilePath();
    const stateDirectoryPath = GLib.path_get_dirname(stateFilePath);
    const serializedState = JSON.stringify(serializeTrackerState(trackerState), null, 2);

    try {
        GLib.mkdir_with_parents(stateDirectoryPath, 0o700);
        GLib.file_set_contents(stateFilePath, serializedState);
    } catch (error) {
        logError(error, 'Focus Task failed to save persisted state');
    }
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const FocusTaskIndicator = GObject.registerClass(
class FocusTaskIndicator extends PanelMenu.Button {
    _init(trackerState = createTrackerState()) {
        super._init(0.0, _('Focus Task'));

        this._trackerState = trackerState;
        this._labelRefreshTimerId = null;
        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._label);
        this._rebuildMenu();
        this._updateLabel();
        this._startLabelRefreshTimer();
    }

    _updateLabel(now = new Date()) {
        this._label.set_text(formatTopBarActivity(this._trackerState, now));
    }

    _startLabelRefreshTimer() {
        this._labelRefreshTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            LABEL_REFRESH_INTERVAL_SECONDS,
            () => {
                try {
                    this._updateLabel();
                } catch (error) {
                    logError(error, 'Focus Task failed to refresh the top bar label');
                }

                return GLib.SOURCE_CONTINUE;
            },
        );
    }

    _stopLabelRefreshTimer() {
        if (this._labelRefreshTimerId === null)
            return;

        GLib.source_remove(this._labelRefreshTimerId);
        this._labelRefreshTimerId = null;
    }

    _setTrackerState(nextState) {
        this._trackerState = createTrackerState(nextState);
        savePersistedTrackerState(this._trackerState);
        this._updateLabel();
        this._rebuildMenu();
    }

    _applySessionSwitch(sessionSwitch) {
        this._setTrackerState({
            taskList: this._trackerState.taskList,
            sessions: sessionSwitch.endedSession === null
                ? this._trackerState.sessions
                : [...this._trackerState.sessions, sessionSwitch.endedSession],
            activeSession: sessionSwitch.activeSession,
        });
    }

    _runMenuAction(action) {
        try {
            action();
        } catch (error) {
            logError(error, 'Focus Task menu action failed');
        }
    }

    _addTaskFromEntry(entry) {
        const taskName = entry.get_text();

        if (taskName.trim() === '')
            return;

        this._setTrackerState({
            taskList: addTaskToList(this._trackerState.taskList, {
                id: createId('task'),
                name: taskName,
            }),
            sessions: this._trackerState.sessions,
            activeSession: this._trackerState.activeSession,
        });
    }

    _renameTaskFromEntry(taskId, entry) {
        const taskName = entry.get_text();

        if (taskName.trim() === '')
            return;

        const taskList = renameTaskInList(this._trackerState.taskList, taskId, taskName);
        const renamedTask = taskList.find(task => task.id === taskId);

        this._setTrackerState({
            taskList,
            sessions: this._trackerState.sessions,
            activeSession: this._renameActiveSessionTask(taskId, renamedTask),
        });
    }

    _renameActiveSessionTask(taskId, renamedTask) {
        const activeSession = this._trackerState.activeSession;
        if (activeSession === null)
            return null;

        // The active task itself was renamed: refresh the running session so the
        // top bar label and reports reflect the new name without a task switch.
        if (activeSession.activity.kind === ActivityKind.TASK && activeSession.activity.id === taskId)
            return {...activeSession, activity: renamedTask};

        // A break or interruption resumes this task: keep the resume target's name
        // in sync so persisted state stays coherent.
        if (activeSession.resumesActivity?.id === taskId)
            return {...activeSession, resumesActivity: renamedTask};

        return activeSession;
    }

    _removeTask(taskId) {
        const activeSession = this._trackerState.activeSession;
        let nextActiveSession = activeSession;
        let sessions = this._trackerState.sessions;

        if (activeSession?.activity?.id === taskId) {
            // The removed task is running: stop tracking it.
            nextActiveSession = null;
        } else if (activeSession?.resumesActivity?.id === taskId) {
            // A break or interruption is paused on the removed task. Ending it
            // later would fail because the task no longer exists, so end it now
            // and record its time instead of leaving the session stranded.
            sessions = [...sessions, endTrackedSession(activeSession, new Date().toISOString())];
            nextActiveSession = null;
        }

        this._setTrackerState({
            taskList: removeTaskFromList(this._trackerState.taskList, taskId),
            sessions,
            activeSession: nextActiveSession,
        });
    }

    _switchToTask(taskId) {
        this._applySessionSwitch(switchActiveTask(this._trackerState.taskList, this._trackerState.activeSession, {
            sessionId: createId('session'),
            taskId,
            switchedAt: new Date().toISOString(),
        }));
    }

    _switchToNextTask() {
        this._applySessionSwitch(switchToNextTask(this._trackerState.taskList, this._trackerState.activeSession, {
            sessionId: createId('session'),
            switchedAt: new Date().toISOString(),
        }));
    }

    _startBreak() {
        this._applySessionSwitch(startBreakSession(this._trackerState.activeSession, {
            sessionId: createId('session'),
            breakId: createId('break'),
            startedAt: new Date().toISOString(),
        }));
    }

    _startInterruption() {
        this._applySessionSwitch(startInterruptionSession(this._trackerState.activeSession, {
            sessionId: createId('session'),
            interruptionId: createId('interruption'),
            startedAt: new Date().toISOString(),
        }));
    }

    _endBreak() {
        this._applySessionSwitch(resumePreviousTaskFromBreak(
            this._trackerState.taskList,
            this._trackerState.activeSession,
            {
                sessionId: createId('session'),
                resumedAt: new Date().toISOString(),
            },
        ));
    }

    _endInterruption() {
        this._applySessionSwitch(resumePreviousTaskFromInterruption(
            this._trackerState.taskList,
            this._trackerState.activeSession,
            {
                sessionId: createId('session'),
                resumedAt: new Date().toISOString(),
            },
        ));
    }

    _createEntryControl({hintText, buttonText, onSubmit}) {
        const item = new PopupMenu.PopupBaseMenuItem({activate: false});
        const entry = new St.Entry({
            hint_text: hintText,
            can_focus: true,
            x_expand: true,
        });
        const button = new St.Button({
            label: buttonText,
            can_focus: true,
            style_class: 'button',
        });
        const submit = () => this._runMenuAction(() => onSubmit(entry));

        entry.clutter_text.connect('activate', submit);
        button.connect('clicked', submit);
        item.add_child(entry);
        item.add_child(button);

        return item;
    }

    // GNOME Shell tracks a single open submenu per top-level menu, so a submenu
    // nested inside another submenu closes its own parent when it opens. Each
    // task therefore gets one flat row instead of its own nested submenu.
    _createTaskEditItem(task) {
        const item = new PopupMenu.PopupBaseMenuItem({activate: false});
        const entry = new St.Entry({
            text: task.name,
            can_focus: true,
            x_expand: true,
        });
        const renameButton = new St.Button({
            label: _('Rename'),
            can_focus: true,
            style_class: 'button',
        });
        const doneButton = new St.Button({
            label: _('Done'),
            can_focus: true,
            style_class: 'button',
        });
        const rename = () => this._runMenuAction(() => this._renameTaskFromEntry(task.id, entry));

        entry.clutter_text.connect('activate', rename);
        renameButton.connect('clicked', rename);
        doneButton.connect('clicked', () => this._runMenuAction(() => this._removeTask(task.id)));

        item.add_child(entry);
        item.add_child(renameButton);
        item.add_child(doneButton);

        return item;
    }

    _createActionItem(label, action, {sensitive = true} = {}) {
        const item = new PopupMenu.PopupMenuItem(label);
        item.setSensitive(sensitive);
        item.connect('activate', () => this._runMenuAction(action));

        return item;
    }

    _createTaskSwitchItem(task) {
        const isActive = this._trackerState.activeSession?.activity?.id === task.id;
        const label = isActive ? `${task.name} (current)` : task.name;

        return this._createActionItem(label, () => this._switchToTask(task.id));
    }

    _createReportLine(label) {
        const item = new PopupMenu.PopupMenuItem(label);
        item.setSensitive(false);

        return item;
    }

    _createReportMenu(reportSection) {
        const reportMenu = new PopupMenu.PopupSubMenuMenuItem(reportSection.title);

        for (const line of reportSection.lines)
            reportMenu.menu.addMenuItem(this._createReportLine(line));

        return reportMenu;
    }

    _rebuildMenu() {
        this.menu.removeAll();

        this.menu.addMenuItem(this._createEntryControl({
            hintText: _('Add Task...'),
            buttonText: _('Add'),
            onSubmit: entry => this._addTaskFromEntry(entry),
        }));
        this.menu.addMenuItem(this._createActionItem(
            _('Switch to Next Task'),
            () => this._switchToNextTask(),
            {sensitive: this._trackerState.taskList.length > 0},
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        for (const task of this._trackerState.taskList)
            this.menu.addMenuItem(this._createTaskSwitchItem(task));

        if (this._trackerState.taskList.length > 0)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const breakInterruptionMenuState = getBreakInterruptionMenuState(this._trackerState);
        this.menu.addMenuItem(this._createActionItem(
            _('Start Break'),
            () => this._startBreak(),
            {sensitive: breakInterruptionMenuState.canStartBreak},
        ));
        this.menu.addMenuItem(this._createActionItem(
            _('Start Interruption'),
            () => this._startInterruption(),
            {sensitive: breakInterruptionMenuState.canStartInterruption},
        ));
        this.menu.addMenuItem(this._createActionItem(
            _('End Break'),
            () => this._endBreak(),
            {sensitive: breakInterruptionMenuState.canEndBreak},
        ));
        this.menu.addMenuItem(this._createActionItem(
            _('End Interruption'),
            () => this._endInterruption(),
            {sensitive: breakInterruptionMenuState.canEndInterruption},
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const reportMenuState = getReportMenuState(this._trackerState);
        this.menu.addMenuItem(this._createReportMenu(reportMenuState.daily));
        this.menu.addMenuItem(this._createReportMenu(reportMenuState.weekly));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this._trackerState.taskList.length === 0)
            return;

        const manageTasksMenu = new PopupMenu.PopupSubMenuMenuItem(_('Manage Tasks'));
        for (const task of this._trackerState.taskList)
            manageTasksMenu.menu.addMenuItem(this._createTaskEditItem(task));

        this.menu.addMenuItem(manageTasksMenu);
    }

    destroy() {
        savePersistedTrackerState(this._trackerState);
        this._stopLabelRefreshTimer();
        super.destroy();
    }
});

export default class FocusTaskExtension extends Extension {
    enable() {
        this._indicator = new FocusTaskIndicator(loadPersistedTrackerState());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
