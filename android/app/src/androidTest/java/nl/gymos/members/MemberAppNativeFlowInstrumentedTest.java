package nl.gymos.members;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MemberAppNativeFlowInstrumentedTest {
    private Instrumentation instrumentation;
    private Activity activity;
    private WebView webView;

    @Before
    public void launchApp() throws Exception {
        instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        activity = instrumentation.startActivitySync(intent);
        instrumentation.waitForIdleSync();
        webView = findWebView(activity);
        assertNotNull("Capacitor should render a WebView", webView);
        waitForShell();
    }

    @After
    public void closeApp() {
        if (activity != null) {
            activity.finish();
        }
    }

    @Test
    public void memberCanNavigateNativeShellSections() throws Exception {
        assertTrue(textContent().contains("Vandaag in je club"));

        tapNav("classes");
        assertFalse(isScreenHidden("classes"));
        assertTrue(textContent().contains("Rooster en vrije plekken"));

        tapNav("pass");
        assertFalse(isScreenHidden("pass"));
        assertTrue(textContent().contains("QR/check-in pass"));

        tapNav("service");
        assertFalse(isScreenHidden("service"));
        assertTrue(textContent().contains("Betaalzaken, pauze en documenten"));

        tapNav("account");
        assertFalse(isScreenHidden("account"));
        assertTrue(textContent().contains("Account verwijderen"));
    }

    @Test
    public void memberJourneyButtonsRouteToTheExpectedPortalDestinations() throws Exception {
        startUrlCapture();

        clickFlow("login");
        clickFlow("reserve");
        clickFlow("cancel-reservation");
        clickFlow("payments");
        clickFlow("pause-request");
        clickFlow("account-delete");
        waitForBoolean(
            "window.GymOSNativeTestHooks.getOpenedUrls().length >= 6",
            "Expected all member journey actions to open their native portal destinations"
        );

        JSONArray urls = openedUrls();
        assertTrue(containsUrl(urls, "https://gym-platform-vc9yk.ondigitalocean.app/login"));
        assertTrue(containsUrl(urls, "https://gym-platform-vc9yk.ondigitalocean.app/reserve"));
        assertTrue(containsUrl(urls, "https://gym-platform-vc9yk.ondigitalocean.app/reserve#mijn-reserveringen"));
        assertTrue(containsUrl(urls, "https://gym-platform-vc9yk.ondigitalocean.app/reserve#contracten-betalingen"));
        assertTrue(containsUrl(urls, "https://gym-platform-vc9yk.ondigitalocean.app/reserve#ledenservice"));
        assertTrue(containsUrl(urls, "https://gym-platform-vc9yk.ondigitalocean.app/reserve#account-verwijderen"));
    }

    @Test
    public void mollieReturnOfflineStateAndAppResumeStayInsideTheNativeShell() throws Exception {
        startUrlCapture();

        evaluate(
            "window.GymOSNativePayments.openPaymentCheckout('https://pay.mollie.com/p/native-qa'); return true;"
        );
        waitForBoolean(
            "window.GymOSNativeTestHooks.getPaymentStatus().includes('Betaling veilig geopend')",
            "Expected Mollie checkout to show the native payment-opened state"
        );
        assertTrue(paymentStatus().contains("Betaling veilig geopend"));
        assertTrue(containsUrl(openedUrls(), "https://pay.mollie.com/p/native-qa"));

        evaluate("window.GymOSNativeTestHooks.handleAppResume(); return true;");
        waitForBoolean(
            "window.GymOSNativeTestHooks.getPaymentStatus().includes('Betaling onderbroken')",
            "Expected app resume to show the interrupted payment state"
        );
        assertTrue(paymentStatus().contains("Betaling onderbroken"));

        evaluate(
            "window.GymOSNativePayments.handlePaymentReturn('gymos://member/payment-return?invoice=inv_qa'); return true;"
        );
        waitForBoolean(
            "!document.querySelector('[data-screen=\"service\"]').hidden && window.GymOSNativeTestHooks.getPaymentStatus().includes('Betaling teruggekeerd')",
            "Expected Mollie return to route back to the service screen"
        );
        assertFalse(isScreenHidden("service"));
        assertTrue(paymentStatus().contains("Betaling teruggekeerd"));

        evaluate("window.GymOSNativeTestHooks.simulateNetworkForQa(false); return true;");
        waitForBoolean(
            "document.body.innerText.includes('Offline') && document.querySelector('[data-capability=\"offline\"]').textContent.includes('Offline pas actief')",
            "Expected offline state to expose the offline pass"
        );
        assertTrue(textContent().contains("Offline"));
        assertTrue(capabilityText("offline").contains("Offline pas actief"));

        evaluate("window.GymOSNativeTestHooks.simulateNetworkForQa(true); return true;");
        waitForBoolean(
            "document.body.innerText.includes('Online')",
            "Expected online state to recover after offline simulation"
        );
        assertTrue(textContent().contains("Online"));
    }

    private void waitForShell() throws Exception {
        long deadline = System.currentTimeMillis() + 30_000;
        String lastState = "";
        while (System.currentTimeMillis() < deadline) {
            instrumentation.waitForIdleSync();
            lastState = evaluateString(
                "JSON.stringify({" +
                    "ready: document.readyState," +
                    "href: window.location.href," +
                    "hook: typeof window.GymOSNativeTestHooks," +
                    "body: (document.body?.innerText || '').slice(0, 120)" +
                "})"
            );
            if (Boolean.TRUE.equals(
                evaluateBoolean(
                    "document.readyState === 'complete' && typeof window.GymOSNativeTestHooks === 'object'"
                )
            )) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("GymOS native shell did not become ready. Last WebView state: " + lastState);
    }

    private WebView findWebView(Activity currentActivity) {
        AtomicReference<WebView> found = new AtomicReference<>();
        instrumentation.runOnMainSync(
            () -> found.set(findWebViewInTree(currentActivity.getWindow().getDecorView()))
        );
        return found.get();
    }

    private WebView findWebViewInTree(View view) {
        if (view instanceof WebView) {
            return (WebView) view;
        }

        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int index = 0; index < group.getChildCount(); index++) {
                WebView found = findWebViewInTree(group.getChildAt(index));
                if (found != null) {
                    return found;
                }
            }
        }

        return null;
    }

    private String evaluate(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(
            () ->
                webView.evaluateJavascript(
                    "(function () { " + script + " })()",
                    value -> {
                        result.set(value);
                        latch.countDown();
                    }
                )
        );

        if (!latch.await(5, TimeUnit.SECONDS)) {
            throw new AssertionError("Timed out while evaluating JavaScript: " + script);
        }

        return result.get();
    }

    private String evaluateString(String script) throws Exception {
        String raw = evaluate("return (" + script + ");");
        if (raw == null || raw.equals("null")) {
            return "";
        }
        return new JSONArray("[" + raw + "]").getString(0);
    }

    private Boolean evaluateBoolean(String script) throws Exception {
        return Boolean.valueOf(evaluate("return (" + script + ");"));
    }

    private void waitForBoolean(String script, String message) throws Exception {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            if (Boolean.TRUE.equals(evaluateBoolean(script))) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError(message);
    }

    private void tapNav(String screen) throws Exception {
        evaluate(
            "document.querySelector('[data-nav=\"" + screen + "\"]').click(); return true;"
        );
    }

    private void clickFlow(String flow) throws Exception {
        evaluate(
            "document.querySelector('[data-qa-flow=\"" + flow + "\"]').click(); return true;"
        );
    }

    private boolean isScreenHidden(String screen) throws Exception {
        return evaluateBoolean(
            "document.querySelector('[data-screen=\"" + screen + "\"]').hidden"
        );
    }

    private String textContent() throws Exception {
        return evaluateString("document.body.innerText");
    }

    private String capabilityText(String capability) throws Exception {
        return evaluateString(
            "document.querySelector('[data-capability=\"" + capability + "\"]').textContent"
        );
    }

    private String paymentStatus() throws Exception {
        return evaluateString("window.GymOSNativeTestHooks.getPaymentStatus()");
    }

    private void startUrlCapture() throws Exception {
        evaluate("window.GymOSNativeTestHooks.startUrlCapture(); return true;");
    }

    private JSONArray openedUrls() throws Exception {
        return new JSONArray(
            evaluateString("JSON.stringify(window.GymOSNativeTestHooks.getOpenedUrls())")
        );
    }

    private boolean containsUrl(JSONArray urls, String expectedUrl) throws Exception {
        for (int index = 0; index < urls.length(); index++) {
            if (expectedUrl.equals(urls.getString(index))) {
                return true;
            }
        }
        return false;
    }
}
