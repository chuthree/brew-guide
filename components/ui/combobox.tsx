"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Command as CommandPrimitive } from "cmdk"

const Combobox = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={cn(
            "flex w-full flex-col overflow-hidden rounded-md bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50",
            className
        )}
        {...props}
    />
))
Combobox.displayName = CommandPrimitive.displayName

const ComboboxInput = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Input>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
    <div className="flex items-center border-b px-3 dark:border-neutral-800" cmdk-input-wrapper="">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <CommandPrimitive.Input
            ref={ref}
            className={cn(
                "flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-neutral-400",
                className
            )}
            {...props}
        />
    </div>
))

ComboboxInput.displayName = CommandPrimitive.Input.displayName

const ComboboxList = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.List
        ref={ref}
        className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
        {...props}
    />
))

ComboboxList.displayName = CommandPrimitive.List.displayName

const ComboboxEmpty = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Empty>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
    <CommandPrimitive.Empty
        ref={ref}
        className="py-6 text-center text-sm"
        {...props}
    />
))

ComboboxEmpty.displayName = CommandPrimitive.Empty.displayName

const ComboboxGroup = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Group>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Group
        ref={ref}
        className={cn(
            "overflow-hidden p-1 text-neutral-950 dark:text-neutral-50",
            className
        )}
        {...props}
    />
))

ComboboxGroup.displayName = CommandPrimitive.Group.displayName

const ComboboxSeparator = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Separator
        ref={ref}
        className={cn("-mx-1 h-px bg-neutral-200 dark:bg-neutral-800", className)}
        {...props}
    />
))
ComboboxSeparator.displayName = CommandPrimitive.Separator.displayName

const ComboboxItem = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Item
        ref={ref}
        className={cn(
            "relative flex cursor-default select-none items-center rounded-sm px-2 py-3 text-sm outline-none aria-selected:bg-neutral-100 aria-selected:text-neutral-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:aria-selected:bg-neutral-800 dark:aria-selected:text-neutral-50",
            className
        )}
        {...props}
    />
))

ComboboxItem.displayName = CommandPrimitive.Item.displayName

const ComboboxShortcut = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
    return (
        <span
            className={cn(
                "ml-auto text-xs tracking-widest text-neutral-500 dark:text-neutral-400",
                className
            )}
            {...props}
        />
    )
}
ComboboxShortcut.displayName = "ComboboxShortcut"

export {
    Combobox,
    ComboboxInput,
    ComboboxList,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxItem,
    ComboboxShortcut,
    ComboboxSeparator,
} 