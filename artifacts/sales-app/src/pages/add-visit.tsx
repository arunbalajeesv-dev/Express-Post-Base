import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateVisit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const visitSchema = z.object({
  mobile_number: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number"),
  customer_name: z.string().min(1, "Customer name is required"),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  feedback: z.enum(["Interested", "Not Interested", "Potential"]),
});

type VisitFormValues = z.infer<typeof visitSchema>;

export default function AddVisit() {
  const { toast } = useToast();
  const createVisit = useCreateVisit();
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      mobile_number: "",
      customer_name: "",
      image_url: "",
      feedback: "Potential",
    },
  });

  const onSubmit = (data: VisitFormValues) => {
    createVisit.mutate({ data }, {
      onSuccess: () => {
        setSuccess(true);
        form.reset();
        setTimeout(() => setSuccess(false), 3000);
        toast({
          title: "Visit recorded",
          description: "Successfully added to the database.",
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || "Failed to record visit",
        });
      }
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <MapPin className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Record Visit</h1>
          <p className="text-sm text-muted-foreground">Log your current field visit</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium text-sm">Visit successfully recorded!</span>
        </div>
      )}

      <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              <FormField
                control={form.control}
                name="mobile_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 9876543210" type="tel" maxLength={10} {...field} className="h-12 text-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Shop or owner name" {...field} className="h-12 text-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feedback</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg">
                          <SelectValue placeholder="Select feedback" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Interested">Interested</SelectItem>
                        <SelectItem value="Potential">Potential</SelectItem>
                        <SelectItem value="Not Interested">Not Interested</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." type="url" {...field} className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-semibold mt-4 shadow-lg shadow-primary/25" 
                disabled={createVisit.isPending}
              >
                {createVisit.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  "Save Visit"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
