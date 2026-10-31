import './style.css';
import { LabApp } from './labApp';

const app = new LabApp(document.querySelector<HTMLDivElement>('#app')!);
void app.init();
