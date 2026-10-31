import './style.css';
import { LabApp } from './labApp';
import { installSessionControls } from './sessionControls';

const app = new LabApp(document.querySelector<HTMLDivElement>('#app')!);
installSessionControls(app);
void app.init();
