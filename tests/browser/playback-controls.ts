import type {Page} from '@playwright/test';
import {speedPosition} from '../../src/traffic/playback';
export async function setRate(page:Page,rate:number){
 const slider=page.getByLabel('Playback speed'),maximum=Number(await slider.getAttribute('data-maximum'));
 await slider.fill(String(Number(speedPosition(rate,maximum).toFixed(4))));
}
