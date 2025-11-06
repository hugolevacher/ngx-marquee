import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({
    selector: '[omMarqueeItem]',
    standalone: true,
})
export class OmMarqueeItemDirective {
    private _context: any;

    @Input('omMarqueeItem')
    set context(value: any) {
        if (value != null && typeof value !== 'object') {
            this._context = {$implicit: value};
        } else if (value && !('$implicit' in value)) {
            this._context = {$implicit: value};
        } else {
            this._context = value;
        }
    }

    get context() {
        return this._context;
    }

    constructor(public template: TemplateRef<any>) {
    }
}
