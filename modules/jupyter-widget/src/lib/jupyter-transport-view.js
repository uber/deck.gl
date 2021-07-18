import {DOMWidgetView} from '@jupyter-widgets/base';
import JupyterTransport from './jupyter-transport';

export default class JupyterTransportView extends DOMWidgetView {
  initialize() {
    this.listenTo(this.model, 'destroy', this.remove);

    // TODO - is there any variable information on the model we can use to
    // give an interesting name or id to this instance?
    this.transport = new JupyterTransport();

    // Expose Jupyter internals to enable work-arounds
    this.transport.jupyterModel = this.model;
    this.transport.jupyterView = this;

    const jsonInput = this.model.get('json_input');
    const json = jsonInput ? JSON.parse(jsonInput) : {};
    this.transport._initialize({json});

    super.initialize.apply(this, arguments);
  }

  remove() {
    if (this.transport) {
      this.transport._finalize();
      this.transport.jupyterModel = null;
      this.transport.jupyterView = null;
      this.transport = null;
    }
  }

  render() {
    super.render();

    this.model.on('change:json_input', this.onJsonChanged.bind(this));
    this.model.on('change:data_buffer', this.onDataBufferChanged.bind(this));

    this.onDataBufferChanged();
  }

  onJsonChanged() {
    const json = JSON.parse(this.model.get('json_input'));
    this.transport._messageReceived({type: 'json', json});
  }

  onDataBufferChanged() {
    const json = this.model.get('json_input');
    const dataBuffer = this.model.get('data_buffer');

    if (json && dataBuffer) {
      this.transport._messageReceived({
        type: 'json-with-binary',
        json,
        binary: dataBuffer
      });
    } else {
      this.transport._messageReceived({type: 'json', json});
    }
  }
}
