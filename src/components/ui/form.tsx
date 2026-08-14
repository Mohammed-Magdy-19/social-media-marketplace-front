"use client"

import * as React from "react"
import {
  Controller,
  FormProvider,
  useFormState,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  const value = React.useMemo(() => ({ name: props.name }), [props.name])
  return (
    <FormFieldContext.Provider value={value}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext?.name })
  const fieldState = getFieldState(fieldContext?.name as string, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({ id: "" })

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()
  const value = React.useMemo(() => ({ id }), [id])
  return (
    <FormItemContext.Provider value={value}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  htmlFor,
  ...props
}: React.ComponentProps<"label"> & { htmlFor?: string }) {
  const { error, formItemId } = useFormField()

  return (
    <label
      data-slot="form-label"
      data-error={!!error}
      htmlFor={htmlFor ?? formItemId}
      className={cn(
        "text-sm leading-none font-medium text-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 data-[error=true]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<"div">) {
  const { error, formDescriptionId, formMessageId } = useFormField()

  return (
    <div
      data-slot="form-control"
      aria-invalid={!!error}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      className="[&_[data-slot=input]]:aria-invalid:border-destructive [&_[data-slot=input]]:aria-invalid:ring-3 [&_[data-slot=input]]:aria-invalid:ring-destructive/20"
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      data-error={!!error}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
