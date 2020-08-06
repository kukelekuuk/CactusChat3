import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {BotContainerService} from "../bot-container.service";
import {remote} from "electron";
import {Router} from "@angular/router";
import {ChatMessage} from "mineflayer";

@Component({
  selector: 'app-chat-screen',
  templateUrl: './chat-screen.component.html',
  styleUrls: ['./chat-screen.component.css']
})
export class ChatScreenComponent implements OnInit, AfterViewChecked, OnDestroy {
  private mineflayer: any;
  private ChatMessage: any;

  backlog: string[] = [];
  private motdparser: any;
  private bot: any;
  players: string[] = [];
  tabPressed = false;

  constructor(private botContainer: BotContainerService, private router: Router, private changeDetector: ChangeDetectorRef) {
  }

  trackByMessage = (index: number, item: string): string => {
    return `${index} ${item}`;
  };
  @ViewChild('scrollMe') private myScrollContainer: ElementRef;
  private disconnecting = false;

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload(): void {
    this.disconnect();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydownEvent(event: KeyboardEvent): boolean {
    if (event.key == "Tab") {
      this.tabPressed = true;
      return false;
    }
    return true;
  }

  @HostListener('document:keyup', ['$event'])
  handleKeyupEvent(event: KeyboardEvent): boolean {
    if (event.key == "Tab") {
      this.tabPressed = false;
      return false;
    }
    return true;
  }

  private disconnect() {
    if (this.bot !== undefined && !this.disconnecting) {
      this.disconnecting = true;
      this.bot.quit("disconnect.quitting");
    }
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (ignored) {
      //
    }
  }

  ngOnInit(): void {
    this.scrollToBottom();
    if (this.botContainer.botData === undefined) {
      this.router.navigate(["/"])
      return;
    }
    this.mineflayer = remote.require("mineflayer");
    this.ChatMessage = this.mineflayer.ChatMessage;

    this.motdparser = remote.require("mcmotdparser")
    this.ChatMessage = remote.require('prismarine-chat')('1.16');

    const botData = this.botContainer.botData;
    const session = {
      accessToken: undefined,
      selectedProfile: undefined,
      clientToken: undefined
    };
    session.accessToken = this.botContainer.accessToken;
    session.clientToken = this.botContainer.clientToken;
    session.selectedProfile = this.botContainer.selectedProfile;
    botData.session = session;
    console.log(botData);
    this.bot = this.mineflayer.createBot(botData);
    this.bot.on("message", (jsonMsg) => {
      const message = new this.ChatMessage(jsonMsg);
      this.addMessage(message)
    })
    this.bot.once("login", () => {
      this.changeDetector.detectChanges();
      this.loadPlayer();
      setInterval(() => this.loadPlayer(), 5000);
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private addMessage(message: ChatMessage) {
    console.log()
    const date = new Date();
    const timestamp = `[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] `;

    //let the chrome engine translate htmlentities
    const p = document.createElement("p");
    p.textContent = message.toMotd();
    const converted = p.innerHTML;

    this.motdparser.toHtml(timestamp + converted, (err, res: string) => {

      this.backlog.push(res);
      this.changeDetector.detectChanges(); //because otherwise it doesn't change on its own
      this.scrollToBottom();
    });
  }

  sendChat(event: KeyboardEvent): void {
    const message = (event.target as HTMLInputElement).value;
    (event.target as HTMLInputElement).value = "";
    this.bot.chat(message)
  }

  private loadPlayer() {
    this.players = []
    for (const player of Object.keys(this.bot.players)) {
      const extra = this.bot.players[player].displayName.extra;
      if (extra === undefined) {
        continue;
      }
      const username: string = extra[0].text;
      const usernameRegex = /^[0-9A-Za-z_]{3,16}$/;
      if (!usernameRegex.test(username)) {
        continue;
      }
      this.players.push(username);
    }
    this.changeDetector.detectChanges()
  }

  disconnectButtonClick(): void {
    this.disconnect();
    this.router.navigate(["/server-list"])
  }
}
