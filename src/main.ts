import Phaser from 'phaser';
import { CalibrationScene } from './game/scenes/CalibrationScene';
import { FightScene } from './game/scenes/FightScene';
import { HelpScene } from './game/scenes/HelpScene';
import { MenuScene } from './game/scenes/MenuScene';
import { SafetyScene } from './game/scenes/SafetyScene';
import { SettingsScene } from './game/scenes/SettingsScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#020617',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // the first scene starts automatically
  scene: [MenuScene, FightScene, CalibrationScene, SettingsScene, HelpScene, SafetyScene],
});
