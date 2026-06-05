import heroVideo from '../assets/videos/hero-video.mp4';
import offeringSushi from '../assets/images/offering-sushi.jpg';
import kitchenSecrets from '../assets/images/kitchen-secrets.jpg';
import giftCard from '../assets/images/gift-card.jpg';
import sushiHero from '../assets/images/sushi-hero.jpg';
import kitchenYellowtailJalapeno from '../assets/images/kitchen-yellowtail-jalapeno.jpg';
import kitchenSashimiSalad from '../assets/images/kitchen-sashimi-salad.jpg';
import kitchenRockShrimp from '../assets/images/kitchen-rock-shrimp.jpg';
import kitchenBlackCodMiso from '../assets/images/kitchen-black-cod-miso.jpg';
import hero from '../assets/images/hero.jpg';
import { commonIcons, contactIcons, formIcons, socialIcons, utilityIcons } from './iconAssets';

const FIGMA = 'https://www.figma.com/api/mcp/asset';

export const homeImages = {
  heroVideo,
  hero,
  offeringSushi,
  kitchenSecrets,
  giftCard,
  sushiHero,
  kitchenYellowtailJalapeno,
  kitchenSashimiSalad,
  kitchenRockShrimp,
  kitchenBlackCodMiso,
  barScene: `${FIGMA}/c6d60d73-cb3c-4bff-b1f8-274e858d299d`,
  happenings: `${FIGMA}/0a5b280d-0482-48cf-85d5-481aa25e9cd4`,
  salmon: `${FIGMA}/d6395b6f-00a5-4108-ba49-2079f3aa9291`,
  gallery: [
    `${FIGMA}/b0ef75a7-e02b-435d-96c8-c0b8c033d2c9`,
    `${FIGMA}/bb2abd4f-013b-4831-bec2-2dbe9fa86875`,
    `${FIGMA}/df6c37a7-0ac9-4c30-859f-755351ff8bc4`,
    `${FIGMA}/b4fa4ccf-7481-49bc-9791-89bc56479796`,
    `${FIGMA}/de065978-798b-4817-91cd-2f856e3417ca`,
    `${FIGMA}/4226f355-fc10-4c16-966d-804419357a70`,
    `${FIGMA}/451228f9-58cf-4760-8ab9-d519af3218ac`,
    `${FIGMA}/dc122290-82cc-4b9c-9a63-c28c8595887d`,
    `${FIGMA}/d8e074b8-7f06-45b9-a849-0950c2e2eeab`,
    `${FIGMA}/4517bcda-ffcf-4be8-8d63-0958acb3cac5`,
  ],
  avatarGordon: `${FIGMA}/025d4d23-b520-4517-a5db-b46adc05e4b1`,
  avatarFaker: `${FIGMA}/050c7c1a-5415-40a8-ba8b-740926c36409`,
  avatarRonaldo: `${FIGMA}/2af224b4-ec0d-4b64-89a8-3e633ca74fc5`,
};

export const homeIcons = {
  star: commonIcons.star,
  chevron: formIcons.chevronDown,
  accessibility: utilityIcons.accessibility,
  scrollTop: utilityIcons.scrollTop,
  scrollTopAlt: utilityIcons.scrollTopAlt,
  socialInstagram: socialIcons.instagram,
  socialFacebook: socialIcons.facebook,
  socialTwitter: socialIcons.twitter,
  socialYoutube: socialIcons.youtube,
  location: contactIcons.location,
  phone: contactIcons.phone,
  email: contactIcons.email,
};
