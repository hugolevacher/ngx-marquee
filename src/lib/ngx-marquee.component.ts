import { CommonModule, isPlatformBrowser } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, Component, ContentChildren, ElementRef, Inject, Input, OnChanges, OnDestroy, PLATFORM_ID, QueryList, signal, SimpleChanges, TemplateRef, ViewChild, } from "@angular/core";
import { Subject } from "rxjs";
import { OmMarqueeItemDirective } from "./ngx-marquee.directive";

@Component({
    selector: "om-marquee",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./ngx-marquee.component.html",
    styleUrl: "./ngx-marquee.component.scss",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxMarqueeComponent
    implements AfterViewInit, OnDestroy, OnChanges {
    @ViewChild("OmMarquee") marqueeRef!: ElementRef<HTMLElement>;

    @ContentChildren(TemplateRef) templates!: QueryList<TemplateRef<any>>;
    @ContentChildren(OmMarqueeItemDirective) marqueeItems!: QueryList<OmMarqueeItemDirective>;

    @Input("styleClass")
    styleClass?: string;

    @Input("reverse")
    set reverse(reverse: boolean) {
        if (reverse) {
            this.style["--om-marquee-reverse"] = "reverse";
            return;
        }

        this.style["--om-marquee-reverse"] = "";
    }

    @Input("animationDuration")
    set animationDuration(animationDuration: string) {
        this.style["--om-marquee-animation-duration"] = animationDuration;
    }

    @Input("marqueeGap")
    set marqueeGap(marqueeGap: string) {
        this.style["--om-marquee-gap"] = marqueeGap;
    }

    @Input("pauseOnHover")
    set pauseOnHover(pauseOnHover: boolean) {
        if (pauseOnHover) {
            this.style["--om-marquee-pause"] = "paused";
            return;
        }

        this.style["--om-marquee-pause"] = "running";
    }

    @Input("vertical")
    vertical = false;

    @Input("scrollable")
    scrollable = false;

    private wasScrollable = this.scrollable;
    private isDragging = false;
    private startCoord = 0;
    private currentTranslate = 0;
    private lastTranslate = 0;

    private unListeners: (() => void)[] = [];

    style: any = {};

    isInView = signal(false);
    private intersectionObserver?: IntersectionObserver;

    constructor(
        @Inject(PLATFORM_ID) private platformId: object,
    ) {
    }

    ngAfterViewInit(): void {
        if (isPlatformBrowser(this.platformId)) {
            this.intersectionObserver = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    if (!this.isInView()) {
                        this.isInView.set(true);
                    }
                } else if (this.isInView) {
                    this.isInView.set(false);
                }
            });
            this.intersectionObserver.observe(this.marqueeRef.nativeElement);

            if (this.scrollable) {
                this.initDragEvents();
            }
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes["scrollable"] && !changes["scrollable"].firstChange) {
            const newVal = changes["scrollable"].currentValue;

            if (newVal && !this.wasScrollable) {
                this.initDragEvents();
            } else if (!newVal && this.wasScrollable) {
                this.cleanupDragEvents();
            }

            this.wasScrollable = newVal;
        }
    }

    destroy$ = new Subject<void>();

    ngOnDestroy(): void {
        this.intersectionObserver?.disconnect();
        this.cleanupDragEvents();
        this.destroy$.next();
        this.destroy$.complete();
    }

    private cleanupDragEvents(): void {
        this.unListeners.forEach((fn) => fn());
        this.unListeners = [];
    }

    private initDragEvents(): void {
        const marqueeContent = this.marqueeRef.nativeElement.querySelector(
            ".om-marquee-content",
        ) as HTMLElement;

        const wrappers = Array.from(
            marqueeContent.querySelectorAll(".om-marquee-item-wrapper"),
        ) as HTMLElement[];

        const onPointerDown = (event: PointerEvent) => {
            if (!this.scrollable) return;

            this.lastTranslate = this.getCurrentTranslate(
                wrappers[0],
                this.vertical ? "y" : "x",
            );
            this.currentTranslate = this.lastTranslate;

            this.isDragging = true;
            this.startCoord = this.vertical ? event.clientY : event.clientX;

            marqueeContent.classList.add("dragging");

            wrappers.forEach((el) => {
                el.classList.add("paused");
                el.style.transform = this.vertical
                    ? `translateY(${this.currentTranslate}px)`
                    : `translateX(${this.currentTranslate}px)`;
            });

            event.preventDefault();
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!this.isDragging) return;

            const currentCoord = this.vertical ? event.clientY : event.clientX;
            const delta = currentCoord - this.startCoord;
            this.currentTranslate = this.lastTranslate + delta;

            const firstWrapper = wrappers[0];
            const wrapperSize = this.vertical
                ? firstWrapper.offsetHeight
                : firstWrapper.offsetWidth;

            const gap = parseFloat(
                getComputedStyle(firstWrapper).getPropertyValue("--om-marquee-gap") ||
                "0",
            );

            const limit = -(wrapperSize + gap);

            if (this.currentTranslate < limit) {
                this.currentTranslate = limit;
            }
            if (this.currentTranslate > 0) {
                this.currentTranslate = 0;
            }

            wrappers.forEach((el) => {
                el.style.transform = this.vertical
                    ? `translateY(${this.currentTranslate}px)`
                    : `translateX(${this.currentTranslate}px)`;
            });
        };

        const onPointerUpOrCancel = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.lastTranslate = this.currentTranslate;

            const firstWrapper = wrappers[0];
            const wrapperSize = this.vertical
                ? firstWrapper.offsetHeight
                : firstWrapper.offsetWidth;

            const gap = parseFloat(
                getComputedStyle(firstWrapper).getPropertyValue("--om-marquee-gap") ||
                "0",
            );

            const totalDistance = wrapperSize + gap;
            const progress = Math.abs(this.currentTranslate) / totalDistance;

            const durationStr = getComputedStyle(firstWrapper).getPropertyValue(
                "--om-marquee-animation-duration",
            );
            const duration = parseFloat(durationStr) * 1000 || 20000;

            const delay = -1 * duration * (this.reverse ? 1 - progress : progress);

            marqueeContent.classList.remove("dragging");

            wrappers.forEach((el) => {
                el.classList.remove("paused");
                el.style.animation = "none";
                void el.offsetWidth;
                el.style.animation = "";
                el.style.animationDelay = `${delay}ms`;
                el.style.transform = "";
            });
        };

        marqueeContent.addEventListener("pointerdown", onPointerDown);
        marqueeContent.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUpOrCancel);
        window.addEventListener("pointercancel", onPointerUpOrCancel);

        this.unListeners.push(() => {
            marqueeContent.removeEventListener("pointerdown", onPointerDown);
            marqueeContent.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUpOrCancel);
            window.removeEventListener("pointercancel", onPointerUpOrCancel);
        });
    }

    private getCurrentTranslate(el: HTMLElement, axis: "x" | "y"): number {
        const computedStyle = getComputedStyle(el);
        const transform = computedStyle.transform;

        if (transform === "none") return 0;

        const match = transform.match(/matrix\(([^)]+)\)/);
        if (!match) return 0;

        const values = match[1].split(", ").map(parseFloat);

        return axis === "x" ? values[4] : values[5];
    }
}
