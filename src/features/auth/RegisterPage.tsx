import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import type { z } from "zod"
import { useRegisterMutation } from "@/features/auth/mutations"
import { registerSchema } from "@/features/auth/schemas"
import { applyFieldErrors, getErrorMessage } from "@/lib/api/errors"
import { Logo } from "@/components/shared/Logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegisterMutation()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      username: "",
      email: "",
      password: "",
    },
  })

  const onSubmit = (values: RegisterValues) => {
    register.mutate(values, {
      onSuccess: (data) => {
        toast.success(data.message ?? "Account created! Welcome aboard 🎉")
        void navigate("/", { replace: true })
      },
      onError: (error) => {
        const applied = applyFieldErrors(
          form.setError,
          error,
          getErrorMessage(error)
        )
        if (!applied) toast.error(getErrorMessage(error))
      },
    })
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-card shadow-lg">
        <CardHeader className="items-center text-center">
          <Logo size={40} />
          <CardTitle className="mt-2 text-xl font-bold">Create your account</CardTitle>
          <p className="text-xs text-muted-foreground">Join the community marketplace</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-3.5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="grid gap-1">
                      <FormLabel className="text-xs font-semibold">
                        First Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Jane"
                          autoComplete="given-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="grid gap-1">
                      <FormLabel className="text-xs font-semibold">
                        Last Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Doe"
                          autoComplete="family-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-semibold">
                      Phone Number <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        autoComplete="tel"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-semibold">
                      Username <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="janedoe"
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-semibold">
                      Email <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-1">
                    <FormLabel className="text-xs font-semibold">
                      Password <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={register.isPending}
                className="mt-2 w-full rounded-full font-semibold shadow-xs"
              >
                {register.isPending ? "Creating account…" : "Sign up"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
