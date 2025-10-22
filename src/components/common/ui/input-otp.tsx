'use client';

import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { cn } from '@/lib/utils/classNameUtils';

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn(
      'flex items-center has-[:disabled]:opacity-50 w-full gap-0',
      containerClassName
    )}
    className={cn('w-full disabled:cursor-not-allowed', className)}
    {...props}
  />
));
InputOTP.displayName = 'InputOTP';

const InputOTPGroup = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-0', className)}
    {...props}
  />
));
InputOTPGroup.displayName = 'InputOTPGroup';

const InputOTPSlot = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex h-[40px] flex-1 items-center justify-center border-b border-neutral-300 bg-transparent py-2 text-base transition-all dark:border-neutral-700',
        'focus-within:border-neutral-800 dark:focus-within:border-neutral-400',
        isActive && 'border-neutral-800 dark:border-neutral-400',
        className
      )}
      {...props}
    >
      {char || <span className="opacity-0">0</span>}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink h-5 w-px bg-neutral-800 dark:bg-neutral-400" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = 'InputOTPSlot';

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className="flex h-[40px] items-center px-1 text-neutral-500 dark:text-neutral-400"
    {...props}
  >
    -
  </div>
));
InputOTPSeparator.displayName = 'InputOTPSeparator';

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
