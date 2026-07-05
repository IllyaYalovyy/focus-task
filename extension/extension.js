import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const FocusTaskIndicator = GObject.registerClass(
class FocusTaskIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Focus Task'));

        this._label = new St.Label({
            text: _('Focus Task 0:00'),
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._label);
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_('No active task')));
    }
});

export default class FocusTaskExtension extends Extension {
    enable() {
        this._indicator = new FocusTaskIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
